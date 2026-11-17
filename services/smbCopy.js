const { execFile } = require("child_process");
const fs = require("fs");

// Copies saved exports to a Windows share with smbclient. Off unless both
// SMB_SHARE (e.g. //10.20.30.43/ffa) and SMB_AUTH_FILE (an smbclient
// authentication file: username / password / domain lines) are set.
const share = process.env.SMB_SHARE;
const authFile = process.env.SMB_AUTH_FILE;

// Docker mounts an empty folder when the auth file is missing on the host.
function enabled() {
  return Boolean(share && authFile && fs.existsSync(authFile) && fs.statSync(authFile).isFile());
}

function smbclient(commands) {
  return new Promise((resolve) => {
    execFile(
      "smbclient",
      [share, "-A", authFile, "-c", commands],
      { timeout: 60000 },
      (error, stdout, stderr) => resolve({ error, out: `${stdout}\n${stderr}` })
    );
  });
}

// Puts the files of localDir into a folder of the same name on the share.
// The share lets us create but not delete or overwrite, so a retry only
// sends what is missing. Resolves when every file is there with its size.
async function copyFolder(localDir, folder, files) {
  const listing = async () => (await smbclient(`ls "${folder}\\*"`)).out;
  const present = (out, name) => {
    const size = fs.statSync(`${localDir}/${name}`).size;
    return new RegExp(`^\\s+${name.replace(/[.]/g, "\\.")}\\s+\\S*\\s+${size}\\s`, "m").test(out);
  };

  let out = await listing();
  const missing = files.filter((name) => !present(out, name));
  if (missing.length) {
    const puts = missing.map((name) => `put "${name}"`).join("; ");
    await smbclient(`mkdir "${folder}"; cd "${folder}"; lcd "${localDir}"; ${puts}`);
    out = await listing();
  }
  const failed = files.filter((name) => !present(out, name));
  if (failed.length) {
    const status = out.match(/NT_STATUS_\w+/);
    throw new Error(`not on the share: ${failed.join(", ")}${status ? ` (${status[0]})` : ""}`);
  }
}

module.exports = { enabled, copyFolder, share };

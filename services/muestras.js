const db = require("./db");
const config = require("../config");

function getMultiple(page = 1) {
  const offset = (page - 1) * config.listPerPage;
  const data = db.query(`SELECT * FROM MUESTRA LIMIT ?,?`, [
    offset,
    config.listPerPage,
  ]);
  const meta = { page };

  return { data, meta };
}

function getAll() {
  const data = db.query(`SELECT * FROM MUESTRA`, []);
  return { data };
}

function getAllFrom(lotNo) {
  const data = db.query(`SELECT * FROM MUESTRA WHERE lot_no = ?`, [lotNo]);
  return { data };
}

function getByLotNo(lotNo) {
  const query = `
    SELECT 
      t1.*,
      GROUP_CONCAT(t3.name) AS defects 
    FROM 
      MUESTRA t1
    LEFT JOIN MUESTRA_DEFECT t2 ON t1.id = t2.muestra_id
    LEFT JOIN DEFFECTS t3 ON t2.defect_id = t3.id 
    WHERE 
      t1.lot_no = ?
    GROUP BY 
      t1.lot_no, t1.id, t1.image, t1.weight, t1.length, t1.height, t1.date, t1.head_length, t1.tail_trigger
  `;

  const data = db.query(query, [lotNo]);
  return { data };
}

function validateCreate(batch) {
  let messages = [];

  console.log(batch);

  if (!batch) messages.push("No object is provided");

  if (!batch.tag) messages.push("theres no tag");

  if (messages.length) {
    let error = new Error(messages.join());
    error.statusCode = 400;
    throw error;
  }
}

function insertMuestraDefects(defects, id) {
  defects.forEach((defect) => {
    const result = db.run(
      "INSERT INTO MUESTRA_DEFECT (muestra_id, defect_id) VALUES (@id, @defect)",
      { id, defect }
    );
    if (result.changes) message = "Quote created successfully";
  });
}

function getById(id) {
     const query = `SELECT *, (SELECT GROUP_CONCAT(t2.defect_id) FROM MUESTRA_DEFECT t2 WHERE t2.muestra_id = t1.id) AS defects FROM MUESTRA t1 WHERE t1.id = ?;`
  // const query = `SELECT t1.*, GROUP_CONCAT(t2.defect_id) AS defects FROM MUESTRA t1, MUESTRA_DEFECT t2 where t1.id = t2.muestra_id and t1.id = ?  GROUP BY t1.id, t1.image, t1.weight, t1.length, t1.height, t1.date, t1.head_length, t1.tail_trigger;`
  const data = db.query(query, [id]);
  return { data };
}

function create(muestra) {
  // validateCreate(batchObj);
  const date = new Date().toLocaleString();
  console.warn(muestra);
  const { image, weight, length, height, head_length, tail_trigger, defects, lot_no } = muestra;
  const result = db.run(
    "INSERT INTO MUESTRA (image, weight, length, height, date, head_length, tail_trigger, lot_no) VALUES (@image, @weight, @length, @height, @date, @head_length, @tail_trigger, @lot_no)",
    { image, weight, length, height, date, head_length, tail_trigger, lot_no }
  );

  let message = "Error in creating batch";
  if (result.changes) message = "Quote created successfully";

  insertMuestraDefects(defects, result.lastInsertRowid);

  console.warn(message);

  return { message };
}

// function changeType(data) {
//   const { id, type } = data;
//   const result = db.run("UPDATE batch SET type = @type WHERE tag = @id", {
//     id,
//     type
//   });

//   let message = "Error in creating batch";
//   if (result.changes) message = "Quote created successfully";

//   console.warn(message);
//   return { message };
// }

// function getType(tag) {
//   const data = db.query(`SELECT type FROM batch WHERE tag = ?`, [tag]);
//   return { data };
// }

module.exports = {
  getMultiple,
  create,
  getById,
  getAll,
  insertMuestraDefects,
  getAllFrom,
  getByLotNo
  // accomulate,
  // changeType,
  // getType,
};

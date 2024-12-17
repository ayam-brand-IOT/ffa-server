const db = require("./db");
const config = require("../config");

function getMultiple(page = 1) {
  const offset = (page - 1) * config.listPerPage;
  const data = db.query(`SELECT * FROM LOT_TENSION LIMIT ?,?`, [
    offset,
    config.listPerPage,
  ]);
  const meta = { page };

  return { data, meta };
}

function getAllFrom(lotNo) {
  const data = db.query(`SELECT * FROM LOT_TENSION WHERE lot_no = ?`, [lotNo]);
  return { data };
}

function getById(id) {
     const query = `SELECT * FROM LOT_TENSION WHERE id = ?;`
  // const query = `SELECT t1.*, GROUP_CONCAT(t2.defect_id) AS defects FROM MUESTRA t1, MUESTRA_DEFECT t2 where t1.id = t2.muestra_id and t1.id = ?  GROUP BY t1.id, t1.image, t1.weight, t1.length, t1.height, t1.date, t1.head_length, t1.tail_trigger;`
  const data = db.query(query, [id]);
  return { data };
}

function create(lot_tension) {
  console.warn(lot_tension);
  const { lot_no, break_point } = lot_tension;
  const result = db.run(
    "INSERT INTO LOT_TENSION (lot_no, break_point) VALUES (@lot_no, @break_point)",
    { lot_no, break_point }
  );

  let message = "Error in creating batch";
  if (result.changes) message = "Quote created successfully";

  console.warn(message);

  return { message };
}


module.exports = {
  getMultiple,
  create,
  getById,
  getAllFrom
  // accomulate,
  // changeType,
  // getType,
};

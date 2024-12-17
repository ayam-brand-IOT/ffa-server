const db = require("./db");
const config = require("../config");

function getMultiple(page = 1) {
  const offset = (page - 1) * config.listPerPage;
  const data = db.query(`SELECT * FROM LOT_IMAGE LIMIT ?,?`, [
    offset,
    config.listPerPage,
  ]);
  const meta = { page };

  return { data, meta };
}

function getAllFrom(lotNo) {
  const data = db.query(`SELECT * FROM LOT_IMAGE WHERE lot_no = ?`, [lotNo]);
  return { data };
}

function getById(id) {
     const query = `SELECT *, (SELECT GROUP_CONCAT(t2.defect_id) FROM MUESTRA_DEFECT t2 WHERE t2.muestra_id = t1.id) AS defects FROM MUESTRA t1 WHERE t1.id = ?;`
  // const query = `SELECT t1.*, GROUP_CONCAT(t2.defect_id) AS defects FROM MUESTRA t1, MUESTRA_DEFECT t2 where t1.id = t2.muestra_id and t1.id = ?  GROUP BY t1.id, t1.image, t1.weight, t1.length, t1.height, t1.date, t1.head_length, t1.tail_trigger;`
  const data = db.query(query, [id]);
  return { data };
}

function create(lot_image) {
  console.warn(lot_image);
  const { lot_no, image } = lot_image;
  const result = db.run(
    "INSERT INTO LOT_IMAGE (lot_no, image) VALUES (@lot_no, @image)",
    { lot_no, image  }
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

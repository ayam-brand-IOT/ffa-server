const db = require("./db");
const config = require("../config");

/*
Lot Structure

supplier: "",
lot_no: "",
production_date: "",
fish_species: "",
type: "",
size: "",
order_no: "",
wms_code: "",
*/

function getMultiple(page = 1) {
    const offset = (page - 1) * config.listPerPage;
    const data = db.query(`SELECT * FROM LOT ORDER BY rowid DESC LIMIT ?,?`, [
        offset,
        config.listPerPage,
    ]);
    const meta = { page };
    return { data, meta };
}

function add(lot){
    const { supplier, lot_no, production_date, fish_species, type, size, order_no, wms_code} = lot;
    const result = db.run(
        "INSERT INTO LOT (supplier, lot_no, production_date, fish_species, type, size, order_no, wms_code) VALUES (@supplier, @lot_no, @production_date, @fish_species, @type, @size, @order_no, @wms_code)",
        { supplier, lot_no, production_date, fish_species, type, size, order_no, wms_code }
    );
    if (result.changes) message = "Quote created successfully";

    return { message };
}

function edit(lot) {    
    const { supplier, lot_no, production_date, fish_species, type, size, order_no, wms_code} = lot;
    const result = db.run(
        "UPDATE LOT SET supplier = @supplier, production_date = @production_date, fish_species = @fish_species, type = @type, size = @size, order_no = @order_no, wms_code = @wms_code WHERE lot_no = @lot_no",
        { supplier, production_date, fish_species, type, size, order_no, wms_code, lot_no }
    );
    if (result.changes) message = "Quote edited successfully";

    return { message };
}

function getAll() {
    const data = db.query(`SELECT * FROM LOT ORDER BY rowid DESC`, []);
    return { data };
}

function getByLotNo(lot_no) {
    const data = db.query(`SELECT * FROM LOT WHERE lot_no = ?`, [lot_no]);
    return data.length > 0 ? data[0] : null;
}

module.exports = {
    getMultiple,
    add,
    edit,
    getAll,
    getByLotNo
  };
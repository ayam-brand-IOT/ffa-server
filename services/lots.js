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
    const data = db.query(`SELECT * FROM LOT LIMIT ?,?`, [
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



module.exports = {
    getMultiple,
    add,
    edit
  };
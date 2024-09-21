const DataURIParser = require("datauri/parser")
const  path = require("path")

const getURI = (file) =>{
    const parser = new DataURIParser()
    console.log("file.originalname",file.originalname)
    const ext = path.extname(file.originalname).toString()
    return parser.format(ext,file.buffer)
}

module.exports = {getURI}
//This module takes as input two files containing
//stringified signatures
//it compares the two signature  files and reports on matching signature percentage
const fs = require('fs'),
	util = require('util')

signature1 = JSON.parse(fs.readFileSync(process.argv[2], "utf-8"))
signature2 = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"))

var fs = require('fs')

file1 = JSON.parse(fs.readFileSync(process.argv[2], "utf-8"))
file2 = JSON.parse(fs.readFileSync(process.argv[3],"utf-8"))
//key = process.argv[4]
//
if (Object.keys(file1).includes("JS Frame") && Object.keys(file2).includes("JS Frame")) {
	console.log(( file2['JS Frame'] - file1['JS Frame'])*100/file1['JS Frame']);
}

if (Object.keys(file1).includes('scripting') && Object.keys(file1).includes('scripting')) {
	console.log( file2['scripting'] - file1['scripting'], file1['scripting']);
}
 if (Object.keys(file1).includes("loadTime") && Object.keys(file2).includes("loadTime")) {
	 console.log(( file2['loadTime'] - file1['loadTime'])*100/file1['loadTime']);
 }
//if ( Object.keys(file1).includes(key) ) {
//	console.log(file1[key][0][1][0]/(1000*file2.scripting))
//}

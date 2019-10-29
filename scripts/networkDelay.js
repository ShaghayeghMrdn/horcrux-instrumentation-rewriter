/*
This module will process the network delays from

Input: Network file
Output: key value map 
    key -> remote ip address
    value -> delay in ms
*/

var fs = require('fs'),
    program = require('commander');

program
    .option("-n, --network [network]", "path to the network data file")
    .option("-o, --output [output]", "path to the output file")
    .parse(process.argv);


var network = JSON.parse(fs.readFileSync(program.network, "utf-8"));

var ip2time = {};

network.forEach((entry)=>{
    if (entry.response && entry.response.remoteIPAddress){
        var _ip = entry.response.remoteIPAddress;
        ip2time[_ip] = 0;
        if (entry.response.timing && entry.response.timing.requestTime)
            ip2time[_ip] = entry.response.timing.connectEnd - entry.response.timing.connectStart;
    }
})

program.output && fs.writeFileSync(program.output, ""), 
Object.keys(ip2time).forEach((key)=>{
    fs.appendFileSync(program.output, key + " " + ip2time[key] + "\n");
})
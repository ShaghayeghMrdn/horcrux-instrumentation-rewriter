const fs = require('fs'),
    util = require('util'),
    program = require('commander'),
    {cpuProfileParser} = require("../devtool-cpu-model/analyze_cpu_profile.js");



const DESKTOP_PROF = "/home/goelayu/research/WebPeformance/outputm2/orig/mobile/imc/top/b2b/0",
    MOBILE_PROF="/home/goelayu/research/WebPeformance/outputm2/orig/mobile/imc/pixel/b2b/0";

program
    .option('-u, --url [url]','site for comparison')
    .parse(process.argv);

var parseFile = function(f){
    // console.log(f);
    return JSON.parse(fs.readFileSync(f),"utf-8");
}

var filterExpensiveFns = function(prof){
    var eF = [];
    eF = prof.parsed.children.filter(e=>e.self > 10).filter(e=>e.profileNode.url.startsWith("http"))
    return eF;
}

var computePerformanceRatio = function(dF, mF){
    var rdF = filterExpensiveFns(dF),
        rmF = filterExpensiveFns(mF);

    rdF.forEach((desktopFn)=>{
        for (var mobileFn of rmF){
            if (JSON.stringify(desktopFn.profileNode.callFrame) == JSON.stringify(mobileFn.profileNode.callFrame)) {
                console.log(mobileFn.self/desktopFn.self);
                break;
            }
        }
    });
    console.log("");
}

function main(){
    var deskopF = `${DESKTOP_PROF}/${program.url}/jsProfile`,
        mobileF = `${MOBILE_PROF}/${program.url}/jsProfile`;
    var desktopProf = cpuProfileParser(parseFile(deskopF)),
        mobileProf = cpuProfileParser(parseFile(mobileF));

    computePerformanceRatio(desktopProf, mobileProf);

}

main();

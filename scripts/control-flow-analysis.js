const fs = require('fs'),
    program = require('commander');

program
    .option("-s,--sig [sig]",'path to signature file')
    .parse(process.argv);

console.log(program.sig)

var cumulateCFI = function(sig){
    var fnCFIS  = {};
    Object.keys(sig).forEach((invoc)=>{
        var fn = invoc.split("_count")[0];

        if (!(fn in fnCFIS))
            fnCFIS[fn] = [];

        fnCFIS[fn].push(
            sig[invoc].filter(e=>e[0]=='CFG')[0][1]
            );
    });

    return fnCFIS;
}

var parse = function(f){
    return JSON.parse(fs.readFileSync(f,'utf-8'));
}

function main(){
    var signature = parse(program.sig).value;
    cumulateCFI(signature);
};

main();
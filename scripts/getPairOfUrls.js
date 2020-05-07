/*
Takes in a file containing host and subsurls 
and returns valid set of pairs
*/

const fs = require('fs'),
    program = require('commander');


const PATH_TO_OUTPUT="/home/goelayu/research/WebPeformance/scripts/sites/",
    URL_LIMIT=200;
program
    .option('-u, --urls [urls]','path to the file containing urls')
    .option('-a, --alexa [alexa]','path containing alexa top urls')
    .parse(process.argv);



var sanitizeStrings = function(str){
    // return str.replace("|","");
    return str.replace(/\|\//,'');
}

var getPairForHost = function(urls){
    var sUrls = urls.sort((a,b)=>{return a.split('/').length - b.split('/').length}),
        rUrls = sUrls.length >= 2 ? sUrls.slice(0,20) : [];

    // return (rUrls.length >= 2 && rUrls[0].split('/').length == rUrls[1].split('/').length
    //     && rUrls[0].split('/').pop()  != "" && rUrls[1].split('/').pop() != "") ?
    //     rUrls : [];

    return rUrls;
}

var storeResult = function(res, f){
    fs.writeFileSync(PATH_TO_OUTPUT +  f,JSON.stringify(res));
}

var _sortDict = function(d){
    var e = Object.entries(d);
    var s = e.sort((a,b)=>{
        return a[1][0].length 
            - b[1][0].length;
    });
    return s;
}

function main(){
    var urlDict = JSON.parse(fs.readFileSync(program.urls,"utf-8")),
        alexaTop = fs.readFileSync(program.alexa,"utf-8"),
        hosts = [], allUrls = [], proccDict = {},
        urlCount = 0;
    var sortedUrlDict = _sortDict(urlDict);
    alexaTop = alexaTop.split('\n').map(e=>e.replace('\r',''));

    sortedUrlDict.forEach((h)=>{
        if (urlCount >= URL_LIMIT) return;
        if (alexaTop.indexOf(sanitizeStrings(h[0]))<0) return;
        var host = h[0];
        var p = getPairForHost(urlDict[host]);
        if (!p.length) return;

        urlCount++;
        host = sanitizeStrings(host);
        hosts.push(host);
        allUrls.push(...p);
        proccDict[host]=p;
    });

    // console.log(proccDict);
    storeResult(hosts,"pairHosts_top");
    storeResult(allUrls,"pairURLS_top");
    storeResult(proccDict,"pairDict_top");

};

main();

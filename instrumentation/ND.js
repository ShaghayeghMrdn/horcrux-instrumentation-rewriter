
// var fondue = require("fondue");
var fs =require("fs"),
    path = require("path"),
    program = require('commander'),
    deterministic = require('deterministic'),
    vm = require('vm');

var header = `
 Date = function(r) {
        var invocationCounter = 0;
        var prevValue = 0;
        var now = r.now();
        function n(n, e, t, a, u, i, f) {
            if (invocationCounter > 50000) 
                throw "Deterministic time breaking the page"
            invocationCounter++;
            var o;
            if (prevValue) return prevValue;
            switch (arguments.length) {
            case 0:
                o = new r(0);
                break;
            case 1:
                o = new r(n);
                break;
            default:
                t = t || 1,
                a = a || 0,
                u = u || 0,
                i = i || 0,
                f = f || 0,
                o = new r(n,e,t,a,u,i,f)
            }
            prevValue = o;
            return o
        }
        return n.parse = r.parse,
        n.UTC = r.UTC,
        n.toString = r.toString,
        n.prototype = r.prototype,
        n.now = function() {
            return now;
        }
        ,
        n
    }(Date),
    Math.random = function() {
        console.log("ranodm called");
        var r, n, e, t;
        return r = .8725217853207141,
        n = .520505596883595,
        e = .22893249243497849,
        t = 1,
        function() {
            var a = 2091639 * r + 2.3283064365386963e-10 * t;
            return r = n,
            n = e,
            t = 0 | a,
            e = a - t
        }
    }()

    `;

program
    .version("0.1.0")
    .option("-i, --input [input]","path to the input file")
    .allowUnknownOption()
    .parse(process.argv)

function injectNDCode(src){
    // return src;
    var isHtml;
     try {
        var script = new vm.Script(src);
        isHtml = false;
    } catch (e) {
        isHtml = true;
    }

    if (!isHtml)
        return src;

    var doctype = "";
    // var doctypeMatch = /^(<!doctype[^\n]+\n)/i.exec(src);
    var doctypeMatch = /^(<!DOCTYPE[ ]+([^ ][^>]+[^ />]+)[ /]*>)/i.exec(src)
    if (doctypeMatch) {
        doctype = doctypeMatch[1];
        src = src.slice(doctypeMatch[1].length);
    }
    var header = "";
    for (i=0;i<140;i++){
        header += deterministic.header;
    }
    src = doctype + "\n<script>\n"  +header+ "\n</script>\n" + src;
    return src;
}

function main(){
    var src = fs.readFileSync(program.input,'utf-8');
    var instrumented = injectNDCode(src);

    fs.writeFileSync(program.input, instrumented);
}

if (program.input)
    main()


module.exports = {
    instrumentHTML : injectNDCode
}


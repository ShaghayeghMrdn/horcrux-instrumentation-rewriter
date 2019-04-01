// pass path to the files as arguments
var fs = require('fs')

OUTFILE = "out"
invocations = JSON.parse(fs.readFileSync(process.argv[2],"utf-8"))
// invocation2 = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"))

// total = Object.keys(invocation2).length
// //console.log("plt time is", process.argv[5]);
// //console.log("Total number of invocations is", total);
// matches = 0
// for (var key2 in invocation2){
// 		if ( JSON.stringify(invocation2[key2]) === JSON.stringify(invocation1[key2])){
// 			matches +=1;
// 	}
// }


var invocationPerFunction = {};
var signaturesPerFunction = {};
var uniqSignatures = [];
Object.keys(invocations).forEach((invocationId)=>{
	var fnName = invocationId.split("_count")[0];
	// console.log(invocationId, fnName);
	if (!invocationPerFunction[fnName])
		invocationPerFunction[fnName]=0;
	invocationPerFunction[fnName]++;
	var sig = JSON.stringify(invocations[invocationId]);
	if (!signaturesPerFunction[fnName])
		signaturesPerFunction[fnName] = [];
	if (signaturesPerFunction[fnName].indexOf(sig)<0)
		signaturesPerFunction[fnName].push(sig);

})

Object.keys(invocationPerFunction).forEach((key)=>{
	// console.log(key,invocationPerFunction[key], signaturesPerFunction[key].length*100/invocationPerFunction[key])
})

Object.keys(signaturesPerFunction).forEach((key)=>{
	uniqSignatures.push(signaturesPerFunction[key].length*100/invocationPerFunction[key]);
})

invocCdf = cdf(Object.values(invocationPerFunction));
sigCdf = cdf(uniqSignatures);

function getPercentile(cdf, percentile){
	// console.log(cdf)
	var index = Math.floor(cdf.length*percentile/100);
	return cdf[index];
}

console.log(getPercentile(invocCdf.xs(), 50), getPercentile(invocCdf.xs(), 90), getPercentile(sigCdf.xs(),50), getPercentile(sigCdf.xs(),90))
// console.log(getPercentile(sigCdf.xs(),50))

// console.log(sig)

function cdf(data){
    "use strict";
    var f, sorted, xs, ps, i, j, l, xx;
    if (Array.isArray(data) && (data.length>0)){
	sorted = data.slice().sort(function(a,b){ return +a-b; });
	xs = [];
	ps = [];
	j=0;
	l=sorted.length;
	xs[0] = sorted[0];
	ps[0] = 1/l;
	for(i=1;i<l;++i){
	    xx = sorted[i];
	    if (xx===xs[j]){
		ps[j] = (1+i)/l;
	    } else {
		j++;
		xs[j] = xx;
		ps[j] = (1+i)/l;
	    }
	}
	f = function(x){
	    var left=0, right=xs.length-1, mid, midval;
	    if (x<xs[0]) return 0;
	    if (x>=xs[xs.length-1]) return 1;
	    while( (right-left)>1 ){
		mid = Math.floor((left+right)/2);
		midval = xs[mid];
		if (x>midval)
		    left = mid;
		else if (x<midval)
		    right = mid;
		else if (x===midval){
		    left = mid;
		    right = mid;
		}
	    }
	    return ps[left];
	};
	f.xs = function(){
	    return xs;
	};
	f.ps = function(){
	    return ps;
	};
    } else {
	// missing or zero length data
	f = function(){};
	f.xs = function(){ return [] };
	f.ps = f.xs;
    }
    return f;
};
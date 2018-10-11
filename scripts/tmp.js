setTimeout(function(){
	var a = 0;
	while (a < 1000000000000) {
		a=a+1;
	}
	console.log("done with the first timeout");
}, 1000);
setTimeout(function(){
	console.log("should be printed after 1 s of execution");
}, 1000)



const fs = require("fs")
const program = require('commander');

program
    .option("-i, --input [input]","HTML/JS file to add the worker shim")
    .parse(process.argv);

src = fs.readFileSync(program.input, "utf-8")
src = `
<script>
    let usesWorker = false
    const __origWorker__ = window.Worker;
    const myWorker = function(url) {
        usesWorker = true
        console.log('>>>>>>>>>> uses web workers!')
        return new __origWorker__(url)
    }
    window.Worker = myWorker;
</script>` + src;

fs.writeFileSync(program.input, src)
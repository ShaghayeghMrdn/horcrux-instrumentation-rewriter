const fs = require("fs")
const program = require('commander');

program
    .option("-i, --input [input]", "HTML/JS file to add the worker shim")
    .option("-t, --type [type]", "[html, js]", "html")
    .parse(process.argv);

src = fs.readFileSync(program.input, "utf-8")
if (program.type != "js") {
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
}

fs.writeFileSync(program.input, src)
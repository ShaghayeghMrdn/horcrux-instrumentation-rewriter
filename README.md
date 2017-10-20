# Web Peformance
Repository to extract web page timeline information using chrome dev tools api

**Steps**
```

/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --headless --remote-debugging-port=9222 --user-data-dir=$TMPDIR/chrome-profiling --no-default-browser-check

npm install

node timeline-trace.js
```
The output file can be loaded into chrome dev tool performance tab

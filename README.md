# Web Peformance
Repository to extract web page timeline information using chrome dev tools api

# Steps

## Desktop (Mac/Linux)
### Generate trace:

```
python run_timeline_trace.py <path to list of urls> <path to output directory> <device type (mac|android)>
```

### Analyse trace: (Group computation into separate categories)
```
python run_log_trace_metrics.py <path to top level directory containing all traces> <path to output directory>
```

### Generate plot from parsed traces:
```
python generate_plot.py <path to parsed trace top level directory>
```

## Android

 * Connect android to the desktop system running these scripts
 * Enabel USB Debugging
 * Start adb server: `adb devices`
 * Follow the same steps as above, with android as the the device type


 ### Extract Trace numbers

  * The instrumented code contains an event handler which automatically computes the number of functions executed and invoked at page load time. 
  * Once the instrumented page is loaded inside a browser:
  ```
  node replay_script.js <path-to-store-metadata> <path-to-store-invocations>
  ```
  * Repeat the same steps either for a different recording of the same web page, or for the same page with a different replay instance

  * With the two invocation files generates using the two runs, generate the stats about the number of intersection function signatures:
  ```
  node compareWebPages.js <path-to-first-invocation> <path-to-second-invocation>
  ```


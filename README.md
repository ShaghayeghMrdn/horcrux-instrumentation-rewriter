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


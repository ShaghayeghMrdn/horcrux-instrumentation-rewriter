
import brotli
import http_record_pb2
import argparse
import zlib
import os
import re
import subprocess
import sys
from copy import deepcopy
from Naked.toolshed.shell import execute_js
import json
import time
import unicodedata
import multiprocessing as mp
from functools import partial

deflate_compress = zlib.compressobj(9, zlib.DEFLATED, -zlib.MAX_WBITS)
zlib_compress = zlib.compressobj(9, zlib.DEFLATED, zlib.MAX_WBITS)
gzip_compress = zlib.compressobj(9, zlib.DEFLATED, zlib.MAX_WBITS | 16)

instrumentation_plugins = {
    "record" : "record.js",
    "replay" : "replay.js",
    "ND" : "ND.js"
}

timeFile = "timeInfo"

def extractUrlFromString(url):
    regex = '(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+'
    urls = re.findall(regex, url)
    if not urls:
        return url[0]
    else:
        return url

def copy(source, destination):
    subprocess.Popen("cp -r {} {}/".format(source, destination), shell=True)

def unchunk(body):
    new_body = ""
    # iterate through chunks until we hit the last chunk
    crlf_loc = body.find('\r\n')
    chunk_size = int( body[:crlf_loc], 16 )
    body = body[crlf_loc+2:]
    while( chunk_size != 0 ):
        # add chunk content to new body and remove from old body
        new_body += body[0:chunk_size]
        body = body[chunk_size:]

        # remove CRLF trailing chunk
        body = body[2:]

        # get chunk size
        crlf_loc = body.find('\r\n')
        chunk_size = int( body[:crlf_loc], 16 )
        body = body[crlf_loc+2:]

    # on the last chunk
    body = body[crlf_loc+2:]

    return new_body

def crossCheckIframeScripts(numberOfScripts, site, stats):
    finalNumber = numberOfScripts
    # print "the site for cross checking:  ", site
    # print "The initial number of scripts ", finalNumber
    iframejs = open(iframe_script_path + site,'r').readlines()
    iframejs = set(iframejs)
    iframejs = list(iframejs)
    iScripts = [i[0] for i in stats[site][1:numberOfScripts+1]]
    for index in range(len(iframejs)):
        filename = iframejs[index].split('/')[-1]
        # print "checking for file name ", filename, "in ", iScripts
        if any([filename.strip() in i for i in iScripts]):
            finalNumber +=1
    # print "returning the final number of scripts ", finalNumber
    return finalNumber

def scriptsToInstrument(stats):
    scriptNames = stats.keys()
    print scriptNames
    # print scriptNames
    scriptsPerUrl = {}
    for site in stats:
        nScripts = len(stats[site])
        # print nScripts, site
        numberOfScripts = scriptsPerThreshhold(stats, site)
        numberOfScripts = crossCheckIframeScripts(numberOfScripts, site, stats)
        print "{0}:{1} for 80% where total length is {2}".format(site,numberOfScripts, len(stats[site][1:]));
        iScripts = [i[0] for i in stats[site][1:numberOfScripts+1]]
        # print iScripts
        # iScripts =  [i.split('/')[-1] for i in iScripts]
        # bName = '/'.join(site.split('/')[6:])
        # bName = bName.split('www.')[-1] 
        scriptsPerUrl[site] = iScripts
        # print site, len(stats[site])
    return scriptsPerUrl

def scriptsPerThreshhold(stats, index):
    timeAr = [i[1] for i in stats[index][1:]]
    threshholdTime = sum(timeAr)*0.8
    t = 0
    n = 0
    for tup in stats[index][1:]:
        if t< threshholdTime:
            t += tup[1]
            n+=1
    return n

def checkStatsForUrl(input, stats):
    url = input.split('/')[-2]
    scriptNames = stats.keys()
    # scriptNames = [i.split('www.')[-1] for i in scriptNames]
    # print scriptNames
    # print input
    # url = '/'.join(input.split('/')[5:])[:-1]
    # url = url.split('www.')[-1]
    # print "url is", url
    # print scriptNames
    if url in scriptNames:
        return True
    else:
        # print url, scriptNames
        return False

def isIframeJS(filename, root):
    iframejs = open(iframe_script_path + root.split('/')[-2],'r').readlines()
    return any([filename in ijs for ijs in iframejs])

# create the output directory

def get_valid_filename(s):
    """
    Return the given string converted to a string that can be used for a clean
    filename. Remove leading and trailing spaces; convert other spaces to
    underscores; and remove anything that is not an alphanumeric, dash,
    underscore, or dot.
    >>> get_valid_filename("john's portrait in 2004.jpg")
    'johns_portrait_in_2004.jpg'
    """
    s = str(s).strip().replace(' ', '_')
    return re.sub(r'(?u)[^-\w.]', '', s)


def instrument(root, fileType, output_directory,args,file):
    f = open(os.path.join(root,file), "rb")
    http_response = http_record_pb2.RequestResponse()
    http_response.ParseFromString(f.read())
    f.close()
    filename = http_response.request.first_line.split()[1]
    origPath = filename
    output_http_response = deepcopy(http_response)
    url = root.split('/')[-2]
    markedToBeDeleted = []
    gzip = False
    gzipType = ""
    TEMP_FILE = "tmp"
    iframe_script_path = "iframeJs2/"
    log_directory = args.logDir

    if len(filename) > 50:
        filename = filename[-50:]
    # filename = get_valid_filename(filename)
    if filename == "/":
        filename = url+filename

    global node_debugging_port

    node_debugging_port+=1
    # pid = os.fork()

    # if pid == 0:
    TEMP_FILE = str(os.getpid())
    TEMP_FILE_zip = TEMP_FILE + ".gz"
    for header in http_response.response.header:
        if header.key.lower() == "content-encoding":
            # print "GZIIPED FILE is " , file
            gzip = True
            gzipType = header.value
            # markedToBeDeleted.append(header.key)

        elif header.key.lower() == "transfer-encoding" and header.value == "chunked":
            http_response.response.body = unchunk(http_response.response.body)
            markedToBeDeleted.append(header.key)

    print "Marked to be deleted headers are: " , markedToBeDeleted

    print "Instrumenting: {} is a {} file".format(file, fileType)
    f = open(TEMP_FILE, "w")
    if gzip:
        try:
            print "Decompressing {} ...with type {}".format(file, gzipType)
            if gzipType.lower() != "br":
                decompressed_data = zlib.decompress(bytes(bytearray(http_response.response.body)), zlib.MAX_WBITS|32)
            else:
                decompressed_data = brotli.decompress(http_response.response.body)
            f.write(decompressed_data)
        except zlib.error as e:
            print "Corrupted decoding: " + file + str(e)
            print "Simply copying the file"
            copy(os.path.join(root,file), os.path.join(args.output, output_directory))
            f.close()
            return
            # os._exit(0)
    else: f.write(http_response.response.body)
    f.close()
    if (args.jsProfile):
    #Pass into the nodejs instrumentation script
        command = " {} -i {} -n '{}' -t {} -j {} -p {}".format("record.js", TEMP_FILE, url + ";;;;" +origPath,fileType,args.jsProfile, args.instOutput)
    elif (args.cgInfo):
        command = " {} -i {} -n '{}' -t {} -c {} -p {}".format("record.js", TEMP_FILE, url + ";;;;" +origPath,fileType,args.cgInfo, args.instOutput)
    else:
        command = " {} -i {} -n '{}' -t {} -p {}".format("record.js",TEMP_FILE, url + ";;;;" + origPath,fileType, args.instOutput)

    if (args.debug) and fileType == args.debug:
        command = "node --inspect-brk={}".format(node_debugging_port) + command
    else:
        command = "node " + command
    _log_path = log_directory+"/"+output_directory+"/" + get_valid_filename(filename) + "/"
    subprocess.call("mkdir -p {}".format(_log_path), shell=True)

    log_file=open(_log_path+"logs","w")
    error_file=open(_log_path+"errors","w")
    # if (args.instOutput != "ND" or fileType == "html"):
    print "Executing ", command
    cmd = subprocess.call(command, stdout=log_file, stderr =error_file, shell=True)
    
    try:
        returnInfoFile = TEMP_FILE + ".info";
        returnInfo = open(returnInfoFile,'r').readline();

        open(_log_path + "info","w").write(returnInfo)
        # open (TEMP_FILE + ".time","w").write(str(static_analysis_overhead))
    except IOError as e:
        print "Error while reading info file" + str(e)

    if gzip:
        file_with_content = TEMP_FILE_zip
        if gzipType.lower() != "br":
            zipUtil = "gzip"
        else: zipUtil = "brotli"
        zipCommand = "{} -c {} > {}".format(zipUtil, TEMP_FILE, TEMP_FILE_zip)
        subprocess.call(zipCommand, shell=True)
        # while cmd.poll() is None:
            # continue
    else:
        file_with_content = TEMP_FILE

    tmpFile = open(file_with_content, "rb")
    modifiedContent = tmpFile.read()
    modifiedLength = len(modifiedContent)
    # print modifiedContent
    # if gzip:
    #     print "Compressing the modified content.."
    #     if gzipType.lower() == "gzip":
    #         compress = gzip_compress
    #         output_http_response.response.body = compress.compress(modifiedContent) + compress.flush()
    #         modifiedLength = len(output_http_response.response.body)
    #     elif gzipType.lower() =="deflate":
    #         compress = deflate_compress
    #         output_http_response.response.body = compress.compress(modifiedContent) + compress.flush()
    #         modifiedLength = len(output_http_response.response.body)
    #     elif gzipType.lower() == "br":
    #         output_http_response.response.body = brotli.compress(modifiedContent)
    #         modifiedLength = len(output_http_response.response.body)
    # else:
    # print "Length of modified content is: ", len(modifiedContent);
    output_http_response.response.body = modifiedContent

    for key in markedToBeDeleted:
        for header in http_response.response.header:
            if header.key == key:
                output_http_response.response.header.remove(header)
                break

    length_header_exists = False
    for header in output_http_response.response.header:
        if header.key.lower() == "content-length":
            header.value = bytes(modifiedLength)
            length_header_exists = True
        if header.key.lower() == "content-security-policy" or header.key.lower() == "content-security-policy-report-only":
            header.value = ""
        if header.key == "Access-Control-Allow-Origin":
            header.value = "*"
    if not length_header_exists:
        length_header = output_http_response.response.header.add()
        length_header.key = "Content-Length"
        length_header.value = bytes(modifiedLength)

    # print " response header looks like " , output_http_response.response.header
    outputFile = open(os.path.join(args.output, output_directory, file), "w")
    
    outputFile.write(output_http_response.SerializeToString())

    outputFile.close()
    tmpFile.close()

    subprocess.call("rm {} {} {}".format(TEMP_FILE, TEMP_FILE_zip, TEMP_FILE +".info"),stderr=open("/dev/null","r"), shell=True)
    # os._exit(0)

node_debugging_port=9229

static_analysis_overhead = 0

def main(args):
    file_counter = 0
    third_party_libraries = ["Bootstrap.js","show_ads_impl.js", "osd.js"]
    TEMP_FILE = "tmp"
    iframe_script_path = "iframeJs2/"
    output_directory = args.input.split('/')[-2]
    print output_directory

    subprocess.Popen("mkdir -p {}".format(args.output), shell=True)
    subprocess.Popen("mkdir -p {}".format(os.path.join(args.output, output_directory)), shell=True)


    http_response = http_record_pb2.RequestResponse()

    for root, folder, files in os.walk(args.input):
        print "This directory has ", len(files), " number of files"
        scriptsToInstrument = [];
        url = root.split('/')[-2]

        htmlFiles = []
        jsFiles = []

        for file in files:
            try:
                file_counter += 1
                f = open(os.path.join(root,file), "rb")
                http_response.ParseFromString(f.read())
                f.close()

                copyFile = True
                fileType = "None"

                print "Checking: {} file : {}".format(file, file_counter)
                for header in http_response.response.header:
                    if header.key.lower() == "content-type":
                        if "javascript" in header.value.lower():
                            fileType = "js"
                            copyFile = False
                            jsFiles.append(file)
                        elif "html" in header.value.lower():
                            fileType = "html"
                            copyFile = False
                            htmlFiles.append(file)

                if copyFile or any(lib.lower() in http_response.request.first_line.lower() for lib in third_party_libraries):
                    print "Simply copying the file without modification.. "
                    # print http_response.request.first_line
                    copy(os.path.join(root,file), os.path.join(args.output, output_directory))

            except IOError as e:
                print args.input + ": Could not open file ", e

    pool = mp.Pool(mp.cpu_count())

    instrument_singleton = partial(instrument, root, "js",output_directory, args)
        
    pool.map(instrument_singleton, jsFiles)
    pool.close()
    pool.join()
    # for jsFile in jsFiles:
    #     instrument(jsFile,root, "js", output_directory,args)

    instrument_singleton = partial(instrument, root, "html",output_directory, args)
    # for pid in childPids:
    #     print "waiting on pid", pid
    #     os.waitpid(pid,0)
    print "All the JS child processes died..\n Main thread terminating"

    pool = mp.Pool(mp.cpu_count())

    pool.map(instrument_singleton, htmlFiles)
    pool.close()
    pool.join()
    # for htmlFile in htmlFiles:
    #     instrument(htmlFile,root, "html", output_directory,args)
    # for pid in childPids:
    #     print "waiting on pid", pid
    #     os.waitpid(pid,0)
    print "All the HTML child processes died..\n Main thread terminating"
    print "Static analysis time:", static_analysis_overhead

    subprocess.Popen("rm staticDump*",stderr=open("/dev/null","r"), shell=True)
    

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('input', help='path to input directory')
    parser.add_argument('output', help='path to output directory')
    parser.add_argument('instOutput', help='type of instrumentation to perform',
     default="record", choices=["cg","record", "replay"])
    parser.add_argument('logDir', help='path to log output directory')
    parser.add_argument('--jsProfile', help='path to the js profile')
    parser.add_argument('--cgInfo',help="path to the cg info")
    parser.add_argument('--debug',help="enable node debugging using -inspect flag")
    args = parser.parse_args()
    main(args)



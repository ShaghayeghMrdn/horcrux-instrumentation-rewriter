
import brotli
import http_record_pb2
import zlib
import os
import re
import subprocess
import sys
from copy import deepcopy
from Naked.toolshed.shell import execute_js

TEMP_FILE = "tmp"

childPids = []
deflate_compress = zlib.compressobj(9, zlib.DEFLATED, -zlib.MAX_WBITS)
zlib_compress = zlib.compressobj(9, zlib.DEFLATED, zlib.MAX_WBITS)
gzip_compress = zlib.compressobj(9, zlib.DEFLATED, zlib.MAX_WBITS | 16)

if len(sys.argv) != 4:
  print "Usage:", sys.argv[0], "HTTP_RESPONSE_FILE", "OUTPUT_DIRECTORY","CACHE_TOGGLE_VALUE (0,1)"
  sys.exit(-1)

subprocess.Popen("mkdir -p {}".format(sys.argv[2]), shell=True)

def extractUrlFromString(url):
    regex = '(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+'
    urls = re.findall(regex, url)
    if not urls:
        return url[0]
    else:
        return url

http_response = http_record_pb2.RequestResponse()

file_counter = 0

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

# create the output directory
output_directory = sys.argv[1].split('/')[-2]
subprocess.Popen("mkdir -p {}".format(os.path.join(sys.argv[2], output_directory)), shell=True)

for root, folder, files in os.walk(sys.argv[1]):
    print "This directory has ", len(files), " number of files"

    for file in files:
        try:
            file_counter += 1
            f = open(os.path.join(root,file), "rb")
            http_response.ParseFromString(f.read())
            output_http_response = deepcopy(http_response)
            f.close()

            copyFile = True
            fileType = None
            gzip = False
            gzipType = ""

            markedToBeDeleted = []

            print "Checking: {} file : {}".format(file, file_counter)
            for header in http_response.response.header:
                if header.key == "Content-Type":
                    if "javascript" in header.value.lower():
                        fileType = "js"
                        copyFile = False
                    elif "html" in header.value.lower():
                        fileType = "html"
                        copyFile = False

            # print http_response.request.first_line
            filename = http_response.request.first_line.split()[1].split('/')[-1]
            if len(filename) > 20:
                filename = filename[-20:]
            if len(filename) == 0:
                filename = "anonymous"

            if copyFile:
                print "Simply copying the file without modification.. "
                copy(os.path.join(root,file), os.path.join(sys.argv[2], output_directory))
            else:
                pid = os.fork()
                if pid == 0:
                    TEMP_FILE = str(os.getpid())
                    for header in http_response.response.header:
                        if header.key == "Content-Encoding":
                            # print "GZIIPED FILE is " , file
                            gzip = True
                            gzipType = header.value
                            # ind = [i for i, header in enumerate(http_response.response.header) if header.key == "Content-Encoding"]
                            # print "deleting ", ind, len(http_response.response.header), len(output_http_response.response.header)
                            # del output_http_response.response.header[ind[0]]
                            # header.value = "identity"
                            markedToBeDeleted.append(header.key)

                        elif header.key == "Transfer-Encoding" and header.value == "chunked":
                            http_response.response.body = unchunk(http_response.response.body)
                            # ind = [i for i, header in enumerate(http_response.response.header) if header.key == "Transfer-Encoding"]
                            # print "deleting ", ind, len(http_response.response.header), len(output_http_response.response.header)
                            # del output_http_response.response.header[ind[0]]
                            # header.value = "identity"
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
                            print "Corrupted decoding: " + file
                            print "The corrupted encoding itself:"  + http_response.response.body
                    else: f.write(http_response.response.body)
                    f.close()

                    #Pass into the nodejs instrumentation script
                    command = "node instrument.js -i {} -n '{}' -t {} --cache-toggle {}".format(TEMP_FILE, re.escape(filename),fileType, sys.argv[3])
                    print "Executing ", command
                    cmd = subprocess.Popen(command, shell=True)
                    while cmd.poll() is None:
                        # print "Waiting for instrumentation..."
                        continue
                    tmpFile = open(TEMP_FILE, "rb")
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

                    for header in output_http_response.response.header:
                        if header.key == "Content-Length":
                            header.value = bytes(modifiedLength)

                    # print " response header looks like " , output_http_response.response.header
                    outputFile = open(os.path.join(sys.argv[2], output_directory, file), "w")
                    
                    outputFile.write(output_http_response.SerializeToString())

                    outputFile.close()
                    tmpFile.close()

                    subprocess.Popen("rm {}".format(TEMP_FILE), shell=True)

                    os._exit(0)
                childPids.append(pid)

        except IOError as e:
            print sys.argv[1] + ": Could not open file ", e

for pid in childPids:
    os.waitpid(pid,0)


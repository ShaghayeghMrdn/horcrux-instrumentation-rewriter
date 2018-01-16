

import sys
import brotli
import http_record_pb2
import zlib
import os
import re
import subprocess
from Naked.toolshed.shell import execute_js

TEMP_FILE = "tmp"
deflate_compress = zlib.compressobj(9, zlib.DEFLATED, -zlib.MAX_WBITS)
zlib_compress = zlib.compressobj(9, zlib.DEFLATED, zlib.MAX_WBITS)
gzip_compress = zlib.compressobj(9, zlib.DEFLATED, zlib.MAX_WBITS | 16)

if len(sys.argv) != 3:
  print "Usage:", sys.argv[0], "HTTP_RESPONSE_FILE", "OUTPUT_DIRECTORY"
  sys.exit(-1)

subprocess.Popen("mkdir -p {}".format(sys.argv[2]), shell=True)

def extractUrlFromString(url):
    regex = '(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+'
    urls = re.findall(regex, url)
    if not urls:
        return url[0]

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


for root, folder, files in os.walk(sys.argv[1]):
    print "This directory has ", len(files), " number of files"

    for file in files:
        try:
            file_counter += 1
            f = open(os.path.join(root,file), "rb")
            http_response.ParseFromString(f.read())
            f.close()

            copyFile = True
            fileType = None
            gzip = False
            gzipType = ""
            setContentLength = False

            print "Checking: {} file : {}".format(file, file_counter)
            for header in http_response.response.header:
                if header.key == "Content-Type":
                    if "javascript" in header.value.lower():
                        fileType = "js"
                        copyFile = False
                    elif "html" in header.value.lower():
                        fileType = "html"
                        copyFile = False
                elif header.key == "Content-Encoding":
                    # print "GZIIPED FILE is " , file
                    gzip = True
                    gzipType = header.value
                    ind = [i for i, header in enumerate(http_response.response.header) if header.key == "Content-Encoding"]
                    del http_response.response.header[ind[0]]

                elif header.key == "Transfer-Encoding" and header.value == "chunked":
                    http_response.response.body = unchunk(http_response.response.body)
                    ind = [i for i, header in enumerate(http_response.response.header) if header.key == "Transfer-Encoding"]
                    print "Deleting the Transfer-Encoding header", ind
                    del http_response.response.header[ind[0]]

                elif header.key == "Content-Length":
                    setContentLength = True
                    ind = [i for i, header in enumerate(http_response.response.header) if header.key == "Content-Length"]
                    del http_response.response.header[ind[0]]


            output_directory = sys.argv[1].split('/')[-2]
            subprocess.Popen("mkdir -p {}".format(os.path.join(sys.argv[2], output_directory)), shell=True)

            if copyFile:
                print "Simply copying the file without modification.. "
                copy(os.path.join(root,file), os.path.join(sys.argv[2], output_directory))
            else:
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
                cmd = subprocess.Popen("node instrument.js -i {} -o {} -t {}".format(TEMP_FILE, os.path.join(sys.argv[2], output_directory,file),fileType), shell=True)
                while cmd.poll() is None:
                    # print "Waiting for instrumentation..."
                    continue

                tmpFile = open(TEMP_FILE, "rb")
                modifiedContent = tmpFile.read()
                # print modifiedContent
                # if gzip:
                #     print "Compressing the modified content.."
                #     if gzipType.lower() == "gzip":
                #         compress = gzip_compress
                #         http_response.response.body = compress.compress(modifiedContent)
                #     elif gzipType.lower() =="deflate":
                #         compress = deflate_compress
                #         http_response.response.body = compress.compress(modifiedContent) + compress.flush()
                #     elif gzipType.lower() == "br":
                #         http_response.response.body = brotli.compress(modifiedContent)
                # else:
                http_response.response.body = modifiedContent

                outputFile = open(os.path.join(sys.argv[2], output_directory, file), "w")
                
                outputFile.write(http_response.SerializeToString())

                outputFile.close()
                tmpFile.close()

        except IOError as e:
            print sys.argv[1] + ": Could not open file ", e

# print zlib.decompress(bytes(bytearray(http_response.response.body)), 15+32)


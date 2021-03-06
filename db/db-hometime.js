// 
// 
var fs = require('fs'),
    path = require('path'),
    JsonDB = require('node-json-db'),
    randomstring = require("randomstring"),
    ffmpeg = require('fluent-ffmpeg'),
    md5 = require('MD5');

// second argument <=> auto save after push || if false we have to call .save()
// thirt argument <=> readable format.
var media_db = new JsonDB(__dirname + '/media', false, true);

var supportFiles = media_db.getData('/supportFiles');

var mimeTypes = media_db.getData('/mimeTypes');
// _ht <=> Hometime
var indexedPrefix = '_ht';

var dirTree = function(filename, res) {

    var stats = fs.lstatSync(filename);

    // if is Directory
    if (stats.isDirectory()) {
        // scan child folder
        fs.readdirSync(filename).map(function(child) {

            return dirTree(filename + '/' + child, res);
        });

    } else {

        var fileType = path.extname(filename);

        // if is media file
        if (fileType && supportFiles.indexOf(fileType) > 0) {

            var basename = path.basename(filename); // cotains exts

            // if file haven't indexed
            if (basename.slice(0, 3) != indexedPrefix) {

                // get name and assign to title
                var title = path.basename(basename, fileType);

                var dirname = path.dirname(filename);

                var o = {

                    ori: filename,

                    indexed: autoGenAndRename(filename, title, dirname, fileType, stats.atime)
                };

                res.push(o);
            }
        }
    }
};

var autoGenAndRename = function(filename, title, dirname, fileType, atime) {

    var indexedNameEts = indexedPrefix + randomstring.generate() + fileType; // ex: _ytRANDOMSTRING.mp4

    // create new full name for fs rename
    var newFullname = path.join(dirname, indexedNameEts);

    //ex: /library/musics/_ytRANDOMSTRING

    var db_source = newFullname.replace(path.join(__dirname, '../media'), '').replace(fileType, '');

    fs.rename(filename, newFullname, function(err) {

        if (err) {
            // retry rename
            console.log(err);
            autoGenAndRename(filename, title, dirname, fileType, atime);

        } else {

            var media = {
                'title': title,
                'fileType': fileType,
                'mediaType': mimeTypes[fileType],
                'poster': '_1.jpg',
                'description': '',
                'addTime': atime
            };
            // save to db
            // the last argument <=> overwrite
            media_db.push(db_source, media, false);
        }
    });

    return db_source;
};

module.exports = {

    getLibrary: function(db, name) {

        var videos = [];

        var qBase = '/library/' + name;

        var mBase = '/media' + qBase + '/';

        try {

            var lib = db.getData(qBase);

            Object.keys(lib).map(function(year) {

                Object.keys(lib[year]).map(function(id) {

                    var vid = lib[year][id];

                    var base = mBase + year + '/';

                    vid.base = base + id;

                    // vid.poster = base + id + vid.poster;

                    // vid.src = base + id + '?V';

                    // vid.subtitle = base + id + '.vtt';

                    videos.push(vid);
                });
            });

            return videos;

        } catch (error) {

            console.error(error);
        }
    },

    saveVideoInfo: function(url, video) {
        // the last argument <=> overwrite
        media_db.push(url, video, false);
    },

    scanNewItem: function(library) {

        var dir = path.join(__dirname, '../media/library', library);

        var res = [];

        // BEGIN SEARCH in FOLDER and IMPORT to DB
        dirTree(dir, res);

        return res;
    },

    generateThumbnails: function(video, callback) {

        var filepath = path.join(__dirname, '../', video.base + video.fileType);

        var dir = path.dirname(filepath);

        var screenshoot = filepath.replace(video.fileType, '_4.jpg');

        // check if already generate
        fs.exists(screenshoot, function(exists) {
            if (exists) {
                console.log('already generated');
                callback(null);
            } else {
                // if not
                var proc = new ffmpeg(filepath)
                    .on('end', function(err) {
                        if (err)
                            callback('something went wrong');
                        else
                            callback(null);
                    })
                    .screenshots({
                        count: 4,
                        size: '460x268',
                        folder: dir,
                        filename: '%b.jpg'
                    });
            }
        });
    },

    loginUser: function(email, pwd, callback) {

        var user_db = new JsonDB(__dirname + '/users', false, true);

        try {
            var md5pwd = md5(pwd);

            var user = user_db.getData('/users/' + email);

            if (md5pwd === user.password) {

                var u = {
                    name: user.name,
                    avatar: user.avatar
                };

                callback(null, u);

            } else {

                callback('wrong password', null);
            }

        } catch (error) {

            if (error)

                callback('not exists', null);
            else {

                console.log(user);
            }
        }
    },

    loginManager: function(email, pwd, callback) {

        var user_db = new JsonDB(__dirname + '/users', false, true);

        try {
            var md5pwd = md5(pwd);

            var user = user_db.getData('/managers/' + email);

            if (md5pwd === user.password) {

                var u = {
                    name: user.name,
                    avatar: user.avatar
                };

                callback(null, u);

            } else {

                callback('wrong password', null);
            }

        } catch (error) {

            if (error)

                callback('not exists', null);
            else {

                console.log(user);
            }
        }
    }
};
/************************ Client and Server **********************************/
function defaultZero (value) {
  return _.isUndefined(value) ? 0 : value;
}

MeteorFile = function (doc, options) {
  options = options || {};
  doc = doc || {};
  this._id = doc._id || Meteor.uuid();
  this.name = doc.name;
  this.type = doc.type;
  this.size = doc.size;
  this.data = doc.data;
  this.start = defaultZero(doc.start);
  this.end = defaultZero(doc.end);
  this.bytesRead = defaultZero(doc.bytesRead);
  this.bytesUploaded = defaultZero(doc.bytesUploaded);

  this.collection = options.collection;
  this.readProgress = defaultZero(doc.readProgress);
  this.uploadProgress = defaultZero(doc.uploadProgress);
};

MeteorFile.fromJSONValue = function (value) {
  return new MeteorFile({
    _id: value._id,
    name: value.name,
    type: value.type,
    size: value.size,
    data: EJSON.fromJSONValue(value.data),
    start: value.start,
    end: value.end,
    bytesRead: value.bytesRead,
    bytesUploaded: value.bytesUploaded,
    readProgress: value.readProgress,
    uploadProgress: value.uploadProgress
  });
};

MeteorFile.humanize = function (size) {
  var gb = Math.pow(1024, 3);
  var mb = Math.pow(1024, 2);
  var kb = 1024;

  if (size >= gb)
    return Math.floor(size / gb) + ' GB';
  else if (size >= 1024^2)
    return Math.floor(size / mb) + ' MB';
  else if (size >= 1024)
    return Math.floor(size / kb) + ' KB';
  else
    return size + ' Bytes';
};

MeteorFile.prototype = {
  constructor: MeteorFile,

  typeName: function () {
    return "MeteorFile";
  },

  equals: function (other) {
    return other._id == this._id;
  },

  clone: function () {
    return new MeteorFile({
      name: this.name,
      type: this.type,
      size: this.size,
      data: this.data,
      start: this.start,
      end: this.end,
      bytesRead: this.bytesRead,
      bytesUploaded: this.bytesUploaded,
      _id: this._id,
      readProgress: this.readProgress,
      uploadProgress: this.uploadProgress
    });
  },

  toJSONValue: function () {
    return {
      _id: this._id,
      name: this.name,
      type: this.type,
      size: this.size,
      data: EJSON.toJSONValue(this.data),
      start: this.start,
      end: this.end,
      bytesRead: this.bytesRead,
      bytesUploaded: this.bytesUploaded,
      readProgress: this.readProgress,
      uploadProgress: this.uploadProgress
    };
  }
};

EJSON.addType("MeteorFile", MeteorFile.fromJSONValue);
/*****************************************************************************/

/************************ Client *********************************************/
if (Meteor.isClient) {
  _.extend(MeteorFile.prototype, {
    read: function (file, options, callback) {
      if (arguments.length == 2)
        callback = options;

      options = options || {};

      var reader = new FileReader;
      var self = this;
      var chunkSize = options.size || 1024 * 1024 * 2; /* 2MB */

      self.size = file.size;
      self.start = self.end;
      self.end += chunkSize;

      if (self.end > self.size)
        self.end = self.size;

      reader.onload = function () {
        self.bytesRead += self.end - self.start;
        self.data = new Uint8Array(reader.result);
        self._setStatus();
        callback && callback(null, self);
      };

      reader.onerror = function () {
        self._setStatus(reader.error);
        callback && callback(reader.error);
      };

      if ((this.end - this.start) > 0) {
        var blob = file.slice(self.start, self.end);
        reader.readAsArrayBuffer(blob);
      }

      return this;
    },

    rewind: function () {
      this.data = null;
      this.start = 0;
      this.end = 0;
      this.bytesRead = 0;
      this.bytesUploaded = 0;
      this.readProgress = 0;
      this.uploadProgress = 0;
    },

    upload: function (file, method, options, callback) {
      var self = this;

      if (!Blob.prototype.isPrototypeOf(file))
        throw new Meteor.Error("First parameter must inherit from Blob");

      if (!_.isString(method))
        throw new Meteor.Error("Second parameter must be a Meteor.method name");

      if (arguments.length < 4 && _.isFunction(options)) {
        callback = options;
        options = {};
      }

      options = options || {};
      self.rewind();
      self.size = file.size;

      var readNext = function () {
        if (self.bytesUploaded < self.size) {
          self.read(file, options, function (err, res) {
            if (err) {
              self.rewind();
              callback && callback(err);
            }
            else {
              Meteor.apply(
                method,
                [self].concat(options.params || []),
                {
                  wait: true
                },
                function (err) {
                  if (err) {
                    self.rewind();
                    self._setStatus(err);
                    callback && callback(err);
                  }
                  else {
                    self.bytesUploaded += self.data.length;
                    self._setStatus();
                    readNext();
                  }
                }
              );
            }
          });
        } else {
          self._setStatus();
          callback && callback(null, self);
        }
      };

      readNext();
      return this;
    },

    _setStatus: function (err) {
      this.readProgress = Math.round(this.bytesRead/this.size * 100);
      this.uploadProgress = Math.round(this.bytesUploaded/this.size * 100);

      if (err)
        this.status = err.toString();
      else if (this.uploadProgress == 100)
        this.status = "Upload complete";
      else if (this.uploadProgress > 0)
        this.status = "File uploading";
      else if (this.readProgress > 0)
        this.status = "File loading";

      if (this.collection) {
        this.collection.update(this._id, {
          $set: {
            status: this.status,
            readProgress: this.readProgress,
            uploadProgress: this.uploadProgress
          }
        });
      }
    }
  });

  _.extend(MeteorFile, {
    read: function (file, options, callback) {
      return new MeteorFile(file).read(file, options, callback);
    },

    upload: function (file, method, options, callback) {
      return new MeteorFile(file).upload(file, method, options, callback);
    }
  });
}
/*****************************************************************************/

/************************ Server *********************************************/
if (Meteor.isServer) {
  var fs = Npm.require('fs');
  var path = Npm.require('path');

  function sanitize (fileName) {
    return fileName
      .replace(/\//g, '')
      .replace(/\.\.+/g, '.')
  }

  _.extend(MeteorFile.prototype, {
    save: function (dirPath, options) {
      var filepath = path.join(dirPath, sanitize(this.name));
      var buffer = new Buffer(this.data);
      var mode = this.start == 0 ? 'w' : 'a';
      var fd = fs.openSync(filepath, mode);
      fs.writeSync(fd, buffer, 0, buffer.length, this.start);
      fs.closeSync(fd);
    }
  });
}
/*****************************************************************************/

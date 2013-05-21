function mb (number) {
  return number * Math.pow(1024, 2);
};

if (Meteor.isServer) {
  Meteor.methods({
    'uploadFile': function (file) {
      return true;
    },

    'testSerialization': function (file) {
      if (file instanceof MeteorFile)
        return true;
      else
        throw new Meteor.Error;
    },

    'testSize': function (file) {
      if (file.size == mb(2))
        return true;
      else
        throw new Meteor.Error;
    }
  });
}

if (Meteor.isClient) {
  function makeFile (size) {
    var blob = new Blob([new Uint8Array(size)], {
      type: 'text/plain'
    });
    blob.name = 'test.txt';
    return blob;
  }

  testAsyncMulti("MeteorFile - read", [
    function (test, expect) {
      var file = makeFile(mb(3));
      var mFile = new MeteorFile(file);

      mFile.read(file, expect(function (err, res) {
        test.equal(res.bytesRead, mb(2),  "Default chunk size should be 2MB");
      }));
    },

    function (test, expect) {
      var file = makeFile(mb(2));
      var mFile = new MeteorFile(file);

      mFile.read(file, expect(function (err, res) {
        test.equal(res.bytesRead, mb(2), "File size should have been 2MB");
      }));
    },

    function (test, expect) {
      var file = makeFile(mb(1));
      var mFile = new MeteorFile(file);

      mFile.read(file, expect(function (err, res) {
        test.equal(res.bytesRead, mb(1), "File size should have been 1MB");
      }));
    }
  ]);

  testAsyncMulti("MeteorFile - upload", [
    function (test, expect) {
      var file = makeFile(mb(2));
      var mFile = new MeteorFile(file);

      mFile.upload(file, "uploadFile", expect(function (err, res) {
        if (err)
          test.fail();
        else
          test.equal(mb(2), res.bytesUploaded, "Expected 2MB to be uploaded");
      }));
    },

    function (test, expect) {
      var file = makeFile(mb(3));
      var mFile = new MeteorFile(file);

      mFile.upload(file, "uploadFile", expect(function (err, res) {
        if (err)
          test.fail();
        else
          test.equal(mb(3), res.bytesUploaded, "Expected 3MB to be uploaded");
      }));
    },

    function (test, expect) {
      var file = makeFile(mb(2));
      var mFile = new MeteorFile(file);
      mFile.upload(file, "testSerialization", expect(function (err, res) {
        test.isNull(err, "MeteorFile serialization to method failed");
      }));
    },

    function (test, expect) {
      var file = makeFile(mb(2));
      var mFile = new MeteorFile(file);
      mFile.upload(file, "testSize", expect(function (err, res) {
        test.isNull(err, "Expected a 2MB file on the server");
      }));
    }
  ]);
}

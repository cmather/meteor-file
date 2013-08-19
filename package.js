Package.describe({
  summary: "Simple file uploading for Meteor"
});

Package.on_use(function (api) {
  api.use(["underscore", "ejson"], ["client", "server"]);
  api.use(["handlebars", "spark"], "client");
  api.add_files(["meteor-file.js"], ["client", "server"]);
  api.add_files("meteor-file-uploader.js", "client");
  api.export("MeteorFile", ["client", "server"]);
});

Package.on_test(function (api) {
  api.use(["meteor-file", "tinytest", "test-helpers"]);
  api.add_files("meteor-file-test.js", ["client", "server"]);
});

Package.describe({
  summary: "Simple file uploading for Meteor"
});

Package.on_use(function (api) {
  api.use(["underscore", "ejson"], ["client", "server"]);
  api.add_files(["meteor-file.js"], ["client", "server"]);
});

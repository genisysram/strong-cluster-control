var Client = require('../lib/client');
var assert = require('assert');
var cluster = require('cluster');

var debug = require('../lib/debug');
var master = require('../lib/master');
var path = require('path');

debug('master', process.pid);

cluster.setupMaster({
  exec: 'test/workers/null.js'
});

describe('master', function() {
  afterEach(function(done) {
    debug('afterEach workers', Object.keys(cluster.workers).length);
    cluster.disconnect(done);
  });

  it('should expose default socket address', function() {
    assert.equal(master.ADDR, 'clusterctl');
  });
  it('should report status array for 0 workers', function(done) {
    master.request({cmd:'status'}, function(rsp) {
      assert.deepEqual(rsp, {workers:[]});
      done();
    });
  });

  it('should report status array for 1 workers', function(done) {
    cluster.fork();
    cluster.once('fork', function() {
      master.request({cmd:'status'}, function(rsp) {
        assert.equal(rsp.workers.length, 1);
        var w0 = rsp.workers[0];
        assert(w0.id);
        assert(w0.pid > 0);
        done();
      });
    });
  });

  it('should report status array for 2 workers', function(done) {
    cluster.fork();
    cluster.once('fork', function() {
      cluster.fork();
      cluster.once('fork', function() {
        master.request({cmd:'status'}, function(rsp) {
          assert.equal(rsp.workers.length, 2);
          var w0 = rsp.workers[0];
          assert(w0.id);
          assert(w0.pid > 0);

          var w1 = rsp.workers[1];
          assert(w1.id);
          assert(w1.pid > 0);
          done();
        });
      });
    });
  });

  it('should report status array for 0 workers, after resize', function(done) {
    cluster.once('online', function() {
      cluster.disconnect(function() {
        master.request({cmd:'status'}, function(rsp) {
          assert.deepEqual(rsp, {workers:[]});
          done();
        });
      });
    });
    cluster.fork();
  });

  it('should start and stop', function(done) {
    master.start();
    master.once('start', function() {
      master.stop();
      master.once('stop', done);
    });
  });

  it('should start on path', function(done) {
    master.start({path:'_ctl'});
    master.once('start', connect);
    
    function connect(addr) {
      assert.equal(addr, '_ctl');
      Client('_ctl', {cmd:'status'}, stop)
        .once('error', function(er) {
          console.log('client', er);
        });
    }
    
    function stop() {
      master.stop();
      master.once('stop', done);
    };

    master.once('error', function(er) {
      console.log('master', er);
    });
  });

  it('should start on port', function(done) {
    master.start({port:4321});
    master.once('start', connect);
    
    function connect(addr) {
      assert.equal(addr.port, 4321);
      Client(4321, {cmd:'status'}, stop)
        .once('error', function(er) {
          console.log('client', er);
        });
    }
    
    function stop() {
      master.stop();
      master.once('stop', done);
    };

    master.once('error', function(er) {
      console.log('master', er);
    });
  });

  it('should return error for unsupported requests', function(done) {
    master.request({cmd:'no-such-command'}, function(rsp) {
      assert(/no-such-command/.test(rsp.error));
      done();
    });
  });

});
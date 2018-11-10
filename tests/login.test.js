const app = require('../server');
const chai = require('chai');
const chaiHttp = require('chai-http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const { TEST_MONGODB_URI, JWT_SECRET } = require('../config');

const User = require('../users/models/user');

const expect = chai.expect;
chai.use(chaiHttp);

describe('API - Login', function () {
  let token;
  const _id = '333333333333333333333333';
  const email = 'example@user.com';
  const username = 'exampleUser';
  const password = 'examplePass';

  before(function () {
    return mongoose.connect(TEST_MONGODB_URI, { useNewUrlParser: true })
      .then(() => mongoose.connection.db.dropDatabase());
  });

  beforeEach(function () {
    return User.hashPassword(password)
      .then(digest => User.create({
        username,
        email,
        password: digest
      }));
  });

  afterEach(function () {
    return mongoose.connection.db.dropDatabase();
  });

  after(function () {
    return mongoose.disconnect();
  });

  describe('API - /api/login', function () {
    it('Should return a valid auth token', function () {
      return chai
        .request(app)
        .post('/api/auth/login')
        .send({ username, email })
        .set('Authorization', token)
        .then(res => {
          expect(res).to.have.status(200);
          expect(res.body).to.be.an('object');
          expect(res.body.authToken).to.be.a('string');

          const payload = jwt.verify(res.body.authToken, JWT_SECRET);
          expect(payload.user).to.not.have.property('password');
          expect(payload.user).excluding(['createdAt', 'updatedAt']).to.deep.equal({ username, email })
        });
    });

    xit('Should reject requests without credentials', function () {
      return chai.request(app)
        .post('/api/login')
        .send({})
        .then(res => {
          expect(res).to.have.status(400);
          expect(res.body).to.be.an('object');
          expect(res.body.message).to.equal('Bad Request');
        });
    });

    xit('Should reject requests with empty string username', function () {
      return chai.request(app)
        .post('/api/login')
        .send({ username: '', password })
        .then(res => {
          expect(res).to.have.status(400);
          expect(res.body).to.be.an('object');
          expect(res.body.message).to.equal('Bad Request');
        });
    });

    xit('Should reject requests with empty string password', function () {
      return chai.request(app)
        .post('/api/login')
        .send({ username, password: '' })
        .then(res => {
          expect(res).to.have.status(400);
          expect(res.body).to.be.an('object');
          expect(res.body.message).to.equal('Bad Request');
        });
    });

    xit('Should reject requests with incorrect username', function () {
      return chai.request(app)
        .post('/api/login')
        .send({ username: 'wrongUsername', password: 'password' })
        .then(res => {
          expect(res).to.have.status(401);
          expect(res.body).to.be.an('object');
          expect(res.body.message).to.equal('Unauthorized');
        });
    });
  });

  describe('/api/refresh', function () {

    xit('should reject requests with no credentials', function () {
      return chai.request(app)
        .post('/api/refresh')
        .then(res => {
          expect(res).to.have.status(401);
        });
    });

    xit('should reject requests with an invalid token', function () {
      token = jwt.sign({ username, password, fullname }, 'Incorrect Secret');
      return chai.request(app)
        .post('/api/refresh')
        .set('Authorization', `Bearer ${token}`)
        .then(res => {
          expect(res).to.have.status(401);
        });
    });

    xit('should reject requests with an expired token', function () {
      token = jwt.sign({ username, password, fullname }, JWT_SECRET, { subject: username, expiresIn: Math.floor(Date.now() / 1000) - 10 });
      return chai.request(app)
        .post('/api/refresh')
        .set('Authorization', `Bearer ${token}`)
        .then(res => {
          expect(res).to.have.status(401);
        });
    });

    xit('should return a valid auth token with a newer expiry date', function () {
      const user = { username, fullname };
      const token = jwt.sign({ user }, JWT_SECRET, { subject: username, expiresIn: '1m' });
      const decoded = jwt.decode(token);

      return chai.request(app)
        .post('/api/refresh')
        .set('Authorization', `Bearer ${token}`)
        .then(res => {
          expect(res).to.have.status(200);
          expect(res.body).to.been.a('object');
          const authToken = res.body.authToken;
          expect(authToken).to.be.a('string');

          const payload = jwt.verify(authToken, JWT_SECRET);
          expect(payload.user).to.deep.equal({ username, fullname });
          expect(payload.exp).to.be.greaterThan(decoded.exp);
        });
    });
  });

});
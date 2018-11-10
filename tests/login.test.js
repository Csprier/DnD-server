require('dotenv').config();
const app = require('../server');
const chai = require('chai');
const chaiHttp = require('chai-http');
const chaiExclude = require('chai-exclude');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const { TEST_MONGODB_URI, JWT_SECRET } = require('../config');

const User = require('../users/models/user');

const expect = chai.expect;
chai.use(chaiHttp);
chai.use(chaiExclude);

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
        _id,
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

  describe('API - /api/auth/login', function () {
    it('Should return a valid auth token', function () {
      return chai
        .request(app)
        .post('/api/auth/login')
        .send({ username, email, password })
        .then(res => {
          expect(res).to.have.status(200);
          expect(res.body).to.be.an('object');
          expect(res.body.authToken).to.be.a('string');

          const payload = jwt.verify(res.body.authToken, JWT_SECRET);
          // console.log('PAYLOAD: ', JSON.stringify(payload, null, 2));
          expect(payload.user).to.not.have.property('password');
					expect(payload.user).excluding(['createdAt', 'updatedAt']).to.deep.equal({ id: payload.user.id, username: payload.user.username, email: payload.user.email });
        });
    });

    it('Should reject requests without credentials', function () {
      return chai.request(app)
        .post('/api/auth/login')
        .send({})
        .then(res => {
          expect(res).to.have.status(400);
          expect(res.body).to.be.an('object');
          expect(res.body.message).to.equal('Bad Request');
        });
    });

    it('Should reject requests with empty string username', function () {
      return chai.request(app)
        .post('/api/auth/login')
        .send({ username: '', password })
        .then(res => {
          expect(res).to.have.status(400);
          expect(res.body).to.be.an('object');
          expect(res.body.message).to.equal('Bad Request');
        });
    });

    it('Should reject requests with empty string password', function () {
      return chai.request(app)
        .post('/api/auth/login')
        .send({ username, password: '' })
        .then(res => {
          expect(res).to.have.status(400);
          expect(res.body).to.be.an('object');
          expect(res.body.message).to.equal('Bad Request');
        });
    });

    it('Should reject requests with incorrect username', function () {
      return chai.request(app)
        .post('/api/auth/login')
        .send({ username: 'wrongUsername', password: 'password' })
        .then(res => {
          expect(res).to.have.status(401);
          expect(res.body).to.be.an('object');
          expect(res.body.message).to.equal('Unauthorized');
        });
    });
  });

  describe('/api/auth/refresh', function () {
    it('should reject requests with no credentials', function () {
      return chai.request(app)
        .post('/api/auth/refresh')
        .then(res => {
          expect(res).to.have.status(401);
        });
    });

    it('should reject requests with an invalid token', function () {
      token = jwt.sign({ username, password, email }, 'Incorrect Secret');
      return chai.request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${token}`)
        .then(res => {
          expect(res).to.have.status(401);
        });
    });

    it('should reject requests with an expired token', function () {
      token = jwt.sign({ username, password, email }, JWT_SECRET, { subject: username, expiresIn: Math.floor(Date.now() / 1000) - 10 });
      return chai.request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${token}`)
        .then(res => {
          expect(res).to.have.status(401);
        });
    });

    it('should return a valid auth token with a newer expiry date', function () {
      const user = { username, email };
      const token = jwt.sign({ user }, JWT_SECRET, { subject: username, expiresIn: '1m' });
      const decoded = jwt.decode(token);

      return chai.request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${token}`)
        .then(res => {
          expect(res).to.have.status(200);
          expect(res.body).to.been.a('object');
          const authToken = res.body.authToken;
          expect(authToken).to.be.a('string');

          const payload = jwt.verify(authToken, JWT_SECRET);
          expect(payload.user).excluding(['createdAt', 'updatedAt']).to.deep.equal({ id: payload.user.id, username, email });
          expect(payload.exp).to.be.greaterThan(decoded.exp);
        });
    });
  });

});
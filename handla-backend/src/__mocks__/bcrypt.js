const bcrypt = {
  hash: jest.fn((data, saltOrRounds) => Promise.resolve(`hashed_${data}`)),
  compare: jest.fn((data, hash) => Promise.resolve(hash === `hashed_${data}`)),
  hashSync: jest.fn((data, saltOrRounds) => `hashed_${data}`),
  compareSync: jest.fn((data, hash) => hash === `hashed_${data}`),
  genSalt: jest.fn(() => Promise.resolve('salt')),
  genSaltSync: jest.fn(() => 'salt'),
};
module.exports = bcrypt;

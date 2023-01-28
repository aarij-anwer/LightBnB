const properties = require('./json/properties.json');
const users = require('./json/users.json');

const { Pool } = require('pg');

const pool = new Pool({
  user: 'vagrant',
  password: '123',
  host: 'localhost',
  database: 'lightbnb'
});

/// Users

/**
 * Get a single user from the database given their email.
 * @param {String} email The email of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithEmail = function(email) {

  const queryString = `
    SELECT * 
    FROM users
    WHERE email = $1
    `;
  const values = [email];

  return pool
    .query(queryString, values)
    .then((result) => {
      return result.rows[0];
    })
    .catch((err) => {
      console.error(err);
    });
};
exports.getUserWithEmail = getUserWithEmail;

/**
 * Get a single user from the database given their id.
 * @param {string} id The id of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithId = function(id) {
  const queryString = `
  SELECT * 
  FROM users
  WHERE id = $1
  `;
  const values = [id];

  return pool
    .query(queryString, values)
    .then((result) => {
      return result.rows[0];
    })
    .catch((err) => {
      console.error(err);
    });
};
exports.getUserWithId = getUserWithId;


/**
 * Add a new user to the database.
 * @param {{name: string, password: string, email: string}} user
 * @return {Promise<{}>} A promise to the user.
 */
const addUser =  function(user) {
  const queryString = `
    INSERT INTO users (name, email, password)
    VALUES ($1, $2, $3)
    RETURNING *;
    `;
  const values = [user.name, user.email, user.password];

  return pool
    .query(queryString, values)
    .then((result) => {
      return result.rows[0];
    })
    .catch((err) => {
      console.error(err);
    });
};
exports.addUser = addUser;

/// Reservations

/**
 * Get all reservations for a single user.
 * @param {string} guest_id The id of the user.
 * @return {Promise<[{}]>} A promise to the reservations.
 */
// eslint-disable-next-line camelcase
const getAllReservations = function(guest_id, limit = 10) {

  const queryString = `
    SELECT reservations.id, properties.*, reservations.start_date, avg(rating) as average_rating
    FROM reservations
    JOIN properties ON reservations.property_id = properties.id
    JOIN property_reviews ON properties.id = property_reviews.property_id
    WHERE reservations.guest_id = $1
    GROUP BY properties.id, reservations.id
    ORDER BY reservations.start_date
    LIMIT $2;
    `;

  // eslint-disable-next-line camelcase
  const values = [guest_id, limit];

  return pool
    .query(queryString, values)
    .then((result) => {
      return result.rows;
    })
    .catch((err) => {
      console.error(err);
    });
};
exports.getAllReservations = getAllReservations;

/// Properties

/**
 * Get all properties.
 * @param {{}} options An object containing query options.
 * @param {*} limit The number of results to return.
 * @return {Promise<[{}]>}  A promise to the properties.
 */

const getAllProperties = (options, limit) => {

  const queryParams = [];
  let queryString = `
  SELECT properties.*, avg(property_reviews.rating) as average_rating
  FROM properties
  JOIN property_reviews ON properties.id = property_id
  `;

  if (options.city) {
    queryParams.push(`%${options.city}%`);
    queryString += `WHERE city LIKE $${queryParams.length} `;
  }
  
  if (options.owner_id) {
    queryParams.push(options.owner_id);
    if (!options.city) {
      //no WHERE clause so add it
      queryString += `WHERE owner_id = $${queryParams.length} `;
    } else {
      //there's already a WHERE clause
      queryString += `AND owner_id = $${queryParams.length} `;
    }
  }

  if (options.minimum_price_per_night && options.maximum_price_per_night) {
    queryParams.push(options.minimum_price_per_night * 100);
    queryParams.push(options.maximum_price_per_night * 100);
    if (options.city || options.owner_id) {
      //there's already a WHERE clause
      queryString += `AND cost_per_night BETWEEN $${queryParams.length - 1} AND $${queryParams.length} `;
    } else {
      //no WHERE clause so add it
      queryString += `WHERE cost_per_night BETWEEN $${queryParams.length - 1} AND $${queryParams.length} `;
    }
  }
  
  if (options.minimum_rating) {
    queryParams.push(options.minimum_rating);
    if (options.city || options.owner_id || (options.minimum_price_per_night && options.maximum_price_per_night)) {
      //there's already a WHERE clause
      queryString += `AND property_reviews.rating >= $${queryParams.length}`;
    } else {
      //no WHERE clause so add it
      queryString += `WHERE property_reviews.rating >= $${queryParams.length}`;
    }
  }

  //limit comes at the end
  queryParams.push(limit);
  queryString += `
  GROUP BY properties.id
  ORDER BY cost_per_night
  LIMIT $${queryParams.length};
  `;
  
  return pool
    .query(queryString, queryParams)
    .then((result) => {
      return result.rows;
    })
    .catch((err) => {
      console.error(err.message);
    });
};

exports.getAllProperties = getAllProperties;


/**
 * Add a property to the database
 * @param {{}} property An object containing all of the property details.
 * @return {Promise<{}>} A promise to the property.
 */
const addProperty = function(property) {

  const queryString = `
    INSERT INTO properties (owner_id, title, description, thumbnail_photo_url, cover_photo_url, cost_per_night, parking_spaces, number_of_bathrooms, number_of_bedrooms, country, street, city, province, post_code, active) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true)
    RETURNING *;
    `;

  const values = [];
  values.push(property.owner_id);

  //check if the form submitted all the fields
  //if yes then insert the value from the property object
  //if not then add a dummy value
  property.title ? values.push(property.title) : values.push('title');
  
  property.description ? values.push(property.description) : values.push('description');
  
  property.thumbnail_photo_url ? values.push(property.thumbnail_photo_url) : values.push('https://images.pexels.com/photos/1172064/pexels-photo-1172064.jpeg?auto=compress&cs=tinysrgb&h=350');
  
  property.cover_photo_url ? values.push(property.cover_photo_url) : values.push('https://images.pexels.com/photos/1172064/pexels-photo-1172064.jpeg');
  
  property.cost_per_night ? values.push(property.cost_per_night) : values.push(1000);
  
  property.parking_spaces ? values.push(property.parking_spaces) : values.push(1);

  property.number_of_bathrooms ? values.push(property.number_of_bathrooms) : values.push(1);

  property.number_of_bedrooms ? values.push(property.number_of_bedrooms) : values.push(1);

  property.country ? values.push(property.country) : values.push('Canada');

  property.street ? values.push(property.street) : values.push('Homeview Court');

  property.city ? values.push(property.city) : values.push('London');

  property.province ? values.push(property.province) : values.push('Ontario');

  property.post_code ? values.push(property.post_code) : values.push('N6C6C1');

  return pool
    .query(queryString, values)
    .then((response) => {
      return response.rows[0];
    })
    .catch((err) => {
      console.error(err);
    });
};
exports.addProperty = addProperty;

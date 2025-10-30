// database.js
const low = require('lowdb');
const fs = require('fs'); // 🔑 Needed for file I/O
const path = require('path'); // 🔑 Needed for file path resolution
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto'); // 🔑 Built-in encryption module



// Read DB name from .env, fallback to "school-bot-db.json"
const dbFile = process.env.DB_NAME || 'school-bot-db.json';
const ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY;


if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
    throw new Error('CRITICAL: DB_ENCRYPTION_KEY environment variable is not set or is not 32 characters long. Encryption failed.');
}
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; 

// --- Custom LowDB Adapter for Encryption/Decryption ---
class CryptoAdapter {
  constructor(filepath, key, algorithm) {
    this.filepath = path.resolve(filepath);
    this.key = key;
    this.algorithm = algorithm;
  }

  read() {
    if (!fs.existsSync(this.filepath)) {
      return {}; // 🔥 FIX: Returns an empty object for safe initialization
    }
    
    try {
      const encrypted = fs.readFileSync(this.filepath, 'utf8');
      
      const iv = Buffer.from(encrypted.slice(0, 32), 'hex');
      const data = encrypted.slice(32);
      
      const decipher = crypto.createDecipheriv(this.algorithm, Buffer.from(this.key), iv);
      let decrypted = decipher.update(data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (e) {
      console.error(`Error reading or decrypting database file: ${e.message}. Initializing with empty object.`);
      return {}; // 🔥 FIX: Returns an empty object on corruption/decryption error
    }
  }

  write(data) {
    const json = JSON.stringify(data, null, 2);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(this.algorithm, Buffer.from(this.key), iv);
    
    let encrypted = cipher.update(json, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const output = iv.toString('hex') + encrypted;
    fs.writeFileSync(this.filepath, output);
  }
}
// Initialize LowDB with chosen database file
const adapter = new CryptoAdapter(dbFile, ENCRYPTION_KEY, ALGORITHM);
const db = low(adapter);


// Set default collections
db.defaults({
  users: [],
  students: [],
  teachers: [],
  teacherlogins: [],
  teacherstudents: [],
  grades: [],
  attendances: [],
  otps: [],
  studentlistrequests: [],
  freelanceoffers: [],
  teachersettings: [],
  uploadedfiles: [],
  botstate: [],
  activitylogs: [],
  approvalMessages: [],
  announcements: [],
  parentcontacts: [] 
}).write();

// --- Ensure meta section for version control ---
if (!db.get('meta').value()) {
  db.set('meta', { version: 0, lastMigrated: null }).write();
}



// Create a class that can be instantiated with 'new'
class Document {
  constructor(data, collectionName) {
    Object.assign(this, data);
    this._collectionName = collectionName;
    this.isNew = !data._id;
  }

  save() {
    const data = { ...this };
    delete data._collectionName;
    delete data.isNew;

    if (this.isNew) {
      // Create new document
      data._id = uuidv4();
      data.createdAt = new Date();
      data.updatedAt = new Date();
      db.get(this._collectionName).push(data).write();
      this._id = data._id;
      this.isNew = false;
    } else {
      // Update existing document
      data.updatedAt = new Date();
      const items = db.get(this._collectionName).value();
      const index = items.findIndex(item => item._id === this._id);
      if (index !== -1) {
        items[index] = data;
        db.set(this._collectionName, items).write();
      }
    }
    return Promise.resolve(this);
  }

  toObject() {
    const obj = { ...this };
    delete obj._collectionName;
    delete obj.isNew;
    delete obj.save;
    delete obj.toObject;
    delete obj.toJSON;
    return obj;
  }

  toJSON() {
    return this.toObject();
  }
}

// Helper function to convert plain objects to Document instances
function convertToDocuments(items, collectionName) {
  return items.map(item => {
    if (item instanceof Document) {
      return item;
    }
    return new Document(item, collectionName);
  });
}

// Simple model function that mimics Mongoose
function createModel(collectionName) {
  function Model(data) {
    if (!(this instanceof Model)) {
      // Handle static method calls
      return Model.create(data);
    }
    return new Document(data, collectionName);
  }

  // Static methods
  Model.find = (query = {}) => {
    let results = db.get(collectionName).value();
    
    // Filter results based on query
    if (Object.keys(query).length > 0) {
      results = results.filter(item => {
        for (let key in query) {
          if (query[key] && typeof query[key] === 'object') {
            // Handle special operators
            if (query[key].$ne !== undefined) {
              if (item[key] === query[key].$ne) return false;
            }
            if (query[key].$in !== undefined) {
              if (!query[key].$in.includes(item[key])) return false;
            }
            if (query[key].$regex !== undefined) {
              const regex = new RegExp(query[key].$regex, query[key].$options || '');
              if (!regex.test(String(item[key]))) return false;
            }
          } else if (item[key] !== query[key]) {
            return false;
          }
        }
        return true;
      });
    }
    
    // Convert to Document instances
    let documentResults = convertToDocuments(results, collectionName);
    
    return {
      sort: (sortObj) => {
        const key = Object.keys(sortObj)[0];
        const order = sortObj[key];
        documentResults.sort((a, b) => {
          if (a[key] < b[key]) return order === 1 ? -1 : 1;
          if (a[key] > b[key]) return order === 1 ? 1 : -1;
          return 0;
        });
        return {
          skip: (num) => {
            documentResults = documentResults.slice(num);
            return {
              limit: (limitNum) => ({ 
                then: (cb) => cb(documentResults.slice(0, limitNum)),
                lean: () => ({ then: (cb) => cb(documentResults.slice(0, limitNum).map(doc => doc.toObject())) })
              }),
              then: (cb) => cb(documentResults),
              lean: () => ({ then: (cb) => cb(documentResults.map(doc => doc.toObject())) })
            };
          },
          limit: (num) => ({ 
            then: (cb) => cb(documentResults.slice(0, num)),
            lean: () => ({ then: (cb) => cb(documentResults.slice(0, num).map(doc => doc.toObject())) })
          }),
          then: (cb) => cb(documentResults),
          lean: () => ({ then: (cb) => cb(documentResults.map(doc => doc.toObject())) })
        };
      },
      skip: (num) => {
        documentResults = documentResults.slice(num);
        return {
          limit: (limitNum) => ({ 
            then: (cb) => cb(documentResults.slice(0, limitNum)),
            lean: () => ({ then: (cb) => cb(documentResults.slice(0, limitNum).map(doc => doc.toObject())) })
          }),
          then: (cb) => cb(documentResults),
          lean: () => ({ then: (cb) => cb(documentResults.map(doc => doc.toObject())) })
        };
      },
      limit: (num) => ({ 
        then: (cb) => cb(documentResults.slice(0, num)),
        lean: () => ({ then: (cb) => cb(documentResults.slice(0, num).map(doc => doc.toObject())) })
      }),
      populate: () => ({ 
        then: (cb) => cb(documentResults),
        lean: () => ({ then: (cb) => cb(documentResults.map(doc => doc.toObject())) })
      }),
      lean: () => ({ 
        then: (cb) => cb(documentResults.map(doc => doc.toObject())),
        exec: () => Promise.resolve(documentResults.map(doc => doc.toObject()))
      }),
      exec: () => Promise.resolve(documentResults),
      then: (cb) => cb(documentResults)
    };
  };

  Model.findOne = (query = {}) => {
    const results = db.get(collectionName).value();
    const item = results.find(item => {
      for (let key in query) {
        if (query[key] && typeof query[key] === 'object') {
          if (query[key].$ne !== undefined) {
            if (item[key] === query[key].$ne) return false;
          }
          if (query[key].$in !== undefined) {
            if (!query[key].$in.includes(item[key])) return false;
          }
        } else if (item[key] !== query[key]) {
          return false;
        }
      }
      return true;
    });
    
    if (item) {
      return Promise.resolve(new Document(item, collectionName));
    }
    return Promise.resolve(null);
  };

  Model.findById = (id) => {
    return Model.findOne({ _id: id });
  };

  Model.create = (data) => {
    const doc = new Document(data, collectionName);
    return doc.save().then(() => doc);
  };

  Model.insertMany = (dataArray) => {
    const newItems = dataArray.map(data => ({
      _id: data._id || uuidv4(),
      ...data,
      createdAt: data.createdAt || new Date(),
      updatedAt: new Date()
    }));

    db.get(collectionName).push(...newItems).write();
    
    // Return documents with save methods
    const documents = newItems.map(item => new Document(item, collectionName));
    return Promise.resolve({
      insertedCount: newItems.length,
      ops: documents,
      insertedIds: newItems.map(item => item._id)
    });
  };

  Model.updateOne = (query, update) => {
    const items = db.get(collectionName).value();
    const index = items.findIndex(item => {
      for (let key in query) {
        if (item[key] !== query[key]) return false;
      }
      return true;
    });

    if (index !== -1) {
      let updatedItem = { ...items[index] };
      
      if (update.$set) {
        updatedItem = { ...updatedItem, ...update.$set };
      }
      if (update.$inc) {
        for (let key in update.$inc) {
          updatedItem[key] = (updatedItem[key] || 0) + update.$inc[key];
        }
      }
      if (update.$push) {
        for (let key in update.$push) {
          if (!updatedItem[key]) updatedItem[key] = [];
          updatedItem[key].push(update.$push[key]);
        }
      }
      if (update.$addToSet) {
        for (let key in update.$addToSet) {
          if (!updatedItem[key]) updatedItem[key] = [];
          const value = update.$addToSet[key];
          if (!updatedItem[key].includes(value)) {
            updatedItem[key].push(value);
          }
        }
      }
      if (update.$pull) {
        for (let key in update.$pull) {
          if (Array.isArray(updatedItem[key])) {
            updatedItem[key] = updatedItem[key].filter(item => item !== update.$pull[key]);
          }
        }
      }

      updatedItem.updatedAt = new Date();
      items[index] = updatedItem;
      db.set(collectionName, items).write();
      
      return Promise.resolve({ 
        modifiedCount: 1, 
        matchedCount: 1,
        acknowledged: true 
      });
    }
    return Promise.resolve({ modifiedCount: 0, matchedCount: 0, acknowledged: true });
  };

  Model.updateMany = (query, update) => {
    const items = db.get(collectionName).value();
    let modifiedCount = 0;

    items.forEach((item, index) => {
      let matches = true;
      for (let key in query) {
        if (item[key] !== query[key]) {
          matches = false;
          break;
        }
      }
      if (matches && update.$set) {
        items[index] = { ...items[index], ...update.$set, updatedAt: new Date() };
        modifiedCount++;
      }
    });

    if (modifiedCount > 0) {
      db.set(collectionName, items).write();
    }
    return Promise.resolve({ modifiedCount, acknowledged: true });
  };

  Model.deleteOne = (query) => {
    const items = db.get(collectionName).value();
    const index = items.findIndex(item => {
      for (let key in query) {
        if (item[key] !== query[key]) return false;
      }
      return true;
    });

    if (index !== -1) {
      items.splice(index, 1);
      db.set(collectionName, items).write();
      return Promise.resolve({ deletedCount: 1, acknowledged: true });
    }
    return Promise.resolve({ deletedCount: 0, acknowledged: true });
  };

  Model.deleteMany = (query) => {
    const items = db.get(collectionName).value();
    const newItems = items.filter(item => {
      for (let key in query) {
        if (item[key] !== query[key]) return true;
      }
      return false;
    });
    
    const deletedCount = items.length - newItems.length;
    if (deletedCount > 0) {
      db.set(collectionName, newItems).write();
    }
    return Promise.resolve({ deletedCount, acknowledged: true });
  };

  Model.countDocuments = (query = {}) => {
    let results = db.get(collectionName).value();
    if (Object.keys(query).length > 0) {
      results = results.filter(item => {
        for (let key in query) {
          if (item[key] !== query[key]) return false;
        }
        return true;
      });
    }
    return Promise.resolve(results.length);
  };

  Model.distinct = (field, query = {}) => {
    let results = db.get(collectionName).value();
    if (Object.keys(query).length > 0) {
      results = results.filter(item => {
        for (let key in query) {
          if (item[key] !== query[key]) return false;
        }
        return true;
      });
    }
    const distinctValues = [...new Set(results.map(item => item[field]))];
    return Promise.resolve(distinctValues.filter(val => val != null));
  };

  Model.aggregate = (pipeline) => {
    let results = db.get(collectionName).value();
    
    pipeline.forEach(stage => {
      if (stage.$match) {
        results = results.filter(item => {
          for (let key in stage.$match) {
            if (item[key] !== stage.$match[key]) return false;
          }
          return true;
        });
      }
      if (stage.$group) {
        const groups = {};
        results.forEach(item => {
          const groupId = stage.$group._id === null ? 'all' : item[stage.$group._id];
          if (!groups[groupId]) groups[groupId] = { _id: groupId };
          
          for (let field in stage.$group) {
            if (field !== '_id') {
              const acc = stage.$group[field];
              if (acc.$sum) {
                groups[groupId][field] = (groups[groupId][field] || 0) + (acc.$sum === 1 ? 1 : item[acc.$sum] || 0);
              }
              if (acc.$addToSet) {
                if (!groups[groupId][field]) groups[groupId][field] = new Set();
                groups[groupId][field].add(item[acc.$addToSet]);
              }
              if (acc.$min) {
                if (groups[groupId][field] === undefined || item[acc.$min] < groups[groupId][field]) {
                  groups[groupId][field] = item[acc.$min];
                }
              }
              if (acc.$max) {
                if (groups[groupId][field] === undefined || item[acc.$max] > groups[groupId][field]) {
                  groups[groupId][field] = item[acc.$max];
                }
              }
            }
          }
        });
        
        // Convert sets to arrays
        Object.keys(groups).forEach(key => {
          for (let field in groups[key]) {
            if (groups[key][field] instanceof Set) {
              groups[key][field] = Array.from(groups[key][field]);
            }
          }
        });
        
        results = Object.values(groups);
      }
      if (stage.$sort) {
        const key = Object.keys(stage.$sort)[0];
        const order = stage.$sort[key];
        results.sort((a, b) => {
          if (a[key] < b[key]) return order === 1 ? -1 : 1;
          if (a[key] > b[key]) return order === 1 ? 1 : -1;
          return 0;
        });
      }
    });
    
    return Promise.resolve(results);
  };

  Model.findOneAndUpdate = (query, update, options = {}) => {
    return Model.findOne(query).then(item => {
      if (item) {
        return Model.updateOne({ _id: item._id }, update).then(() => {
          if (options.new !== false) {
            return Model.findOne({ _id: item._id });
          }
          return item;
        });
      }
      return null;
    });
  };

  Model.findOneAndDelete = (query) => {
    return Model.findOne(query).then(item => {
      if (item) {
        return Model.deleteOne({ _id: item._id }).then(() => item);
      }
      return null;
    });
  };

  return Model;
}

// Create all models as constructors
const User = createModel('users');
const Student = createModel('students');
const Teacher = createModel('teachers');
const TeacherLogin = createModel('teacherlogins');
const TeacherStudent = createModel('teacherstudents');
const Grade = createModel('grades');
const Attendance = createModel('attendances');
const OTP = createModel('otps');
const StudentListRequest = createModel('studentlistrequests');
const FreelanceOffer = createModel('freelanceoffers');
const TeacherSettings = createModel('teachersettings');
const UploadedFile = createModel('uploadedfiles');
const BotState = createModel('botstate');
const ActivityLog = createModel('activitylogs');
const ApprovalMessage = createModel('approvalMessages');
const Announcement = createModel('announcements');
const ParentContact = createModel('parentcontacts');


// Mock mongoose for compatibility
const mongoose = {
  Schema: class Schema {
    constructor(structure, options = {}) {
      this.structure = structure;
      this.options = options;
    }
  },
  model: (name, schema) => {
    const models = {
      'User': User,
      'Student': Student,
      'Teacher': Teacher,
      'TeacherLogin': TeacherLogin,
      'TeacherStudent': TeacherStudent,
      'Grade': Grade,
      'Attendance': Attendance,
      'OTP': OTP,
      'StudentListRequest': StudentListRequest,
      'FreelanceOffer': FreelanceOffer,
      'TeacherSettings': TeacherSettings,
      'UploadedFile': UploadedFile,
      'BotState': BotState,
      'ApprovalMessage': ApprovalMessage,
      'ParentContact': ParentContact,
      "ActivityLog": ActivityLog,
      "Announcement": Announcement
    };
    return models[name];
  },
  Types: {
    ObjectId: String,
    Mixed: Object
  },
  connection: {
    on: (event, callback) => {
      if (event === 'connected') {
        setTimeout(callback, 100);
      }
    },
    readyState: 1
  }
};

const connectWithRetry = () => {
  console.log('Database initialized.');
  return Promise.resolve();
};


// --- Migration version helpers ---
function getDBVersion() {
  const meta = db.get('meta').value();
  return meta?.version || 0;
}

function setDBVersion(newVersion) {
  db.set('meta', { version: newVersion, lastMigrated: new Date().toISOString() }).write();
}


module.exports = {
  User,
  Student,
  Teacher,
  TeacherLogin,
  TeacherStudent,
  Grade,
  Attendance,
  OTP,
  StudentListRequest,
  FreelanceOffer,
  TeacherSettings,
  UploadedFile,
  BotState,
  mongoose,
  ActivityLog,
  connectWithRetry,
  ApprovalMessage,
  Announcement,
  getDBVersion,
  setDBVersion,
  db,
  ParentContact

};
const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const mongoUrl = process.env.MONGODB_URI;
const dbName = 'contacts';
const collectionName = 'contacts';

app.use(bodyParser.json());

let client;
let db;

async function connectToMongo() {
    client = new MongoClient(mongoUrl, {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
        },
    });

    try {
        await client.connect();
        db = client.db(dbName);
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error('Error connecting to MongoDB:', err);
        throw err;
    }
}

connectToMongo();

async function findContactByFingerprint(fingerprint) {
    if (!db) {
        console.error('MongoDB connection not established');
        return Promise.reject(new Error('MongoDB connection not established'));
    }

    return db.collection(collectionName).findOne({ fingerprint: fingerprint });
}

async function createPrimaryContact(fingerprint, email, phoneNumber) {
    const contact = {
        _id: uuidv4(),
        fingerprint,
        email,
        phoneNumber,
        linkPrecedence: 'primary',
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    await db.collection(collectionName).insertOne(contact);
    return contact;
}

async function createSecondaryContact(primaryContactId, fingerprint, email, phoneNumber) {
    const contact = {
        _id: uuidv4(),
        linkedId: primaryContactId,
        fingerprint,
        email,
        phoneNumber,
        linkPrecedence: 'secondary',
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    await db.collection(collectionName).insertOne(contact);
    return contact;
}

app.post('/', async (req, res) => {
    const { fingerprint, email, phoneNumber } = req.body;
    if (!fingerprint) {
        return res.status(400).json({ error: 'Fingerprint not provided' });
    }

    const existingContact = await findContactByFingerprint(fingerprint);

    if (!existingContact) {
        const newContact = await createPrimaryContact(fingerprint, email, phoneNumber);
        res.status(200).json({
            primaryContactId: newContact._id,
            fingerprint: newContact.fingerprint,
            emails: [newContact.email],
            phoneNumbers: [newContact.phoneNumber],
            secondaryContactIds: [],
        });
    } else {
        const newSecondaryContact = await createSecondaryContact(existingContact._id, fingerprint, email, phoneNumber);

        const secondaryContacts = await db.collection(collectionName)
            .find({ linkedId: existingContact._id, linkPrecedence: 'secondary' })
            .toArray();

        const secondaryContactIds = secondaryContacts.map(contact => contact._id || '');
        const emails = [existingContact.email, newSecondaryContact.email];
        const phoneNumbers = [existingContact.phoneNumber, newSecondaryContact.phoneNumber];

        res.status(200).json({
            primaryContactId: existingContact._id,
            fingerprint: existingContact.fingerprint,
            emails,
            phoneNumbers,
            secondaryContactIds: [newSecondaryContact._id, ...secondaryContactIds],
        });
    }
});

module.exports = app;

const { MongoClient, ServerApiVersion } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

const mongoUrl = process.env.MONGO_URL;
const dbName = 'contacts';
const collectionName = 'contacts';

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

module.exports = async (req, res) => {
    if (req.method === 'POST' && req.url === '/identify') {
        const { fingerprint, email, phoneNumber } = req.body;

        if (!fingerprint) {
            return res.status(400).json({ error: 'Fingerprint not provided' });
        }

        const existingContact = await findContactByFingerprint(fingerprint);

        if (!existingContact) {
            // Create a new "primary" contact
            const newContact = await createPrimaryContact(fingerprint, email, phoneNumber);
            console.log('New Primary Contact Created:', newContact);
            res.status(200).json({
                primaryContactId: newContact._id,
                fingerprint: newContact.fingerprint,
                emails: [newContact.email],
                phoneNumbers: [newContact.phoneNumber],
                secondaryContactIds: [],
            });
        } else {
            // Create a new "secondary" contact
            const newSecondaryContact = await createSecondaryContact(existingContact._id, fingerprint, email, phoneNumber);
            // Fetch existing secondary contacts
            // Implement fetching of secondary contacts
            // Respond accordingly
        }
    } else {
        res.status(404).end();
    }
};

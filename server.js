const express = require('express');
const forge = require('node-forge');
const jwt = require('jsonwebtoken'); // Add this line
const app = express();
const PORT = 8080;

app.use(express.json());

// Define an array to store key pairs and their metadata
const keyPairs = [];

// generate a unique Key ID (kid)
function generateUniqueKeyID() {
    // Implement your logic to generate a unique Key ID here, such as using a UUID library.
    // For simplicity, you can generate a random ID for demonstration purposes.
    return Math.random().toString(36).substr(2, 10);
}

// check if a key has expired
function isKeyExpired(expiryTimestamp) {
    const currentTimestamp = new Date();
    return currentTimestamp > expiryTimestamp;
}

app.get('/jwks', (req, res) => {
    // Filter and include only unexpired key pairs
    const validKeyPairs = keyPairs.filter(keyPair => !isKeyExpired(keyPair.expiryTimestamp));

    // Create a JWKS-formatted response
    const jwksResponse = {
        keys: validKeyPairs.map(keyPair => {
            return {
                kid: keyPair.kid,
                kty: 'RSA',
                alg: 'RS256',
                use: 'sig',
                n: keyPair.publicKey,
                e: 'AQAB' // Exponent for RSA keys
            };
        })
    };

    res.json(jwksResponse);
});

app.post('/auth', (req, res) => {
    const { expired } = req.query;

    // Find an unexpired key pair 
    const unexpiredKeyPair = keyPairs.find(keyPair => !isKeyExpired(keyPair.expiryTimestamp));

    if (!unexpiredKeyPair) {
        return res.status(500).json({ error: 'No valid keys available.' });
    }

    const currentTimestamp = Math.floor(Date.now() / 1000); // Current time in seconds

    const payload = {
        sub: 'user_id',
        name: 'John Doe',
        iat: currentTimestamp,
    };

    
    // Conditionally set the expiration time based on the "expired" query parameter
    if (expired === 'true') {
        // Use the key's expiration timestamp
        payload.exp = Math.floor(unexpiredKeyPair.expiryTimestamp.getTime() / 1000);
    } else {
        // Set a 1-minute expiration time from the current time
        payload.exp = payload.iat + 60; // 60 seconds (1 minute) from the current time
    }

    // Sign the payload using the selected key pair's private key
    const token = jwt.sign(payload, unexpiredKeyPair.privateKey, { algorithm: 'RS256' });

    res.json({ token });
});


app.get('/keyPair', (req, res) => {

    // Generate an RSA key pair with a key size of 2048 bits
    const keyPair = forge.pki.rsa.generateKeyPair(2048);

    // Export the keys in PEM format
    const privateKeyPem = forge.pki.privateKeyToPem(keyPair.privateKey);
    const publicKeyPem = forge.pki.publicKeyToPem(keyPair.publicKey);

    // Generate a unique Key ID (kid) for this key pair
    const kid = generateUniqueKeyID();

    // Set an expiry timestamp
    const currentTimestamp = Math.floor(Date.now() / 1000); // Current time in seconds
    const expirationTimestamp = currentTimestamp + 60; // 60 seconds (1 minute) from the current time
    const expiryTimestamp = new Date(expirationTimestamp * 1000); // Convert to milliseconds

    // Store the key pair and metadata
    const keyMetadata = {
        kid,
        privateKey: privateKeyPem,
        publicKey: publicKeyPem,
        expiryTimestamp,
    };

    keyPairs.push(keyMetadata);

    // Return the keys and metadata as a JSON response
    res.json(keyMetadata);
});

app.listen(
    PORT,
    () => console.log(`Running on http://localhost:${PORT}`)
)

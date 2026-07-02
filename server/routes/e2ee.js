const express = require('express');
const router = express.Router();
const User = require('../models/User');
const ConversationKey = require('../models/ConversationKey');
const verifyToken = require('../middleware/Verifytoken');

// 1. Upload E2EE keys (public key and encrypted private key backup)
router.post('/keys', verifyToken, async (req, res) => {
  const { publicKey, encryptedPrivateKey } = req.body;
  if (!publicKey || !encryptedPrivateKey) {
    return res.status(400).json({ error: 'publicKey and encryptedPrivateKey are required' });
  }

  try {
    await User.findByIdAndUpdate(req.userId, {
      publicKey,
      encryptedPrivateKey
    });
    res.status(200).json({ success: true, message: 'Keys saved successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Fetch public key of a user, or self's keys (including private backup)
router.get('/keys/:userId', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('publicKey encryptedPrivateKey');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const payload = {
      publicKey: user.publicKey
    };

    // Only return the encrypted private key if requesting user is the owner
    if (req.userId.toString() === req.params.userId) {
      payload.encryptedPrivateKey = user.encryptedPrivateKey;
    }

    res.status(200).json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Save conversation key for participants
router.post('/conversation-keys', verifyToken, async (req, res) => {
  const { conversationId, keys } = req.body; // keys: [{ userId, encryptedKey }]
  if (!conversationId || !Array.isArray(keys)) {
    return res.status(400).json({ error: 'conversationId and keys array are required' });
  }

  try {
    const ops = keys.map(k => ({
      updateOne: {
        filter: { conversationId, userId: k.userId },
        update: { encryptedKey: k.encryptedKey },
        upsert: true
      }
    }));

    await ConversationKey.bulkWrite(ops);
    res.status(200).json({ success: true, message: 'Conversation keys saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Fetch conversation key for current user
router.get('/conversation-key/:conversationId', verifyToken, async (req, res) => {
  try {
    const convKey = await ConversationKey.findOne({
      conversationId: req.params.conversationId,
      userId: req.userId
    });

    if (!convKey) {
      return res.status(404).json({ error: 'Conversation key not found' });
    }

    res.status(200).json({ encryptedKey: convKey.encryptedKey });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

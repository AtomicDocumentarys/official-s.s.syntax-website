const express = require('express');
const cors = require('cors');
const path = require('path');

// --- CONFIGURATION ---
const PORT = process.env.PORT || 3000;

// --- EXPRESS APP ---
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- ROUTES ---

// Home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Dashboard page
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API: Bot status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    name: 'S.S. Syntax',
    message: 'Bot is running'
  });
});

// API: Mock commands
app.get('/api/commands', (req, res) => {
  res.json({
    commands: [
      { id: '1', name: 'ping', code: 'message.reply("Pong!")', description: 'Simple ping command' },
      { id: '2', name: 'help', code: 'message.channel.send("Help menu")', description: 'Shows help menu' }
    ]
  });
});

// API: Save command (mock)
app.post('/api/commands', (req, res) => {
  const { name, code, description } = req.body;
  console.log('Saving command:', { name, code, description });
  res.json({ 
    success: true, 
    message: 'Command saved successfully',
    command: { id: Date.now().toString(), name, code, description }
  });
});

// API: Delete command (mock)
app.delete('/api/commands/:id', (req, res) => {
  console.log('Deleting command:', req.params.id);
  res.json({ success: true, message: 'Command deleted' });
});

// Health check for Railway
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- SERVER STARTUP ---
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
});

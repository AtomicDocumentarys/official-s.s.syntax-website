let currentSelectedGuild = null;

async function validateAndCreateCommand() {
    if (!currentSelectedGuild) return alert("Please select a server first!");

    const command = {
        id: "cmd_" + Math.random().toString(36).substr(2, 9),
        name: document.getElementById('commandName').value,
        type: document.getElementById('commandType').value,
        trigger: document.getElementById('commandTrigger').value,
        prefix: document.getElementById('commandPrefix').value,
        language: document.getElementById('commandLanguage').value,
        code: document.getElementById('commandCode').value,
        createdAt: new Date().toISOString()
    };

    if (!command.name || !command.code) return alert("Command Name and Code are required!");

    try {
        const response = await fetch('/api/save-command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guildId: currentSelectedGuild, command })
        });

        if (response.ok) {
            alert("Command successfully deployed to server!");
            resetForm();
        }
    } catch (err) {
        console.error(err);
        alert("Failed to save command.");
    }
}

function updateTriggerOptions() {
    const type = document.getElementById('commandType').value;
    document.getElementById('prefixGroup').style.display = (type === 'prefix') ? 'block' : 'none';
    document.getElementById('triggerGroup').style.display = (type === 'message' || type === 'reaction') ? 'block' : 'none';
}

function resetForm() {
    document.getElementById('commandName').value = '';
    document.getElementById('commandCode').value = '';
}

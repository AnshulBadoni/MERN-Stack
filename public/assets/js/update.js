document.getElementById('update-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(event.target);
  const urlParams = new URLSearchParams(window.location.search);
  const userId = urlParams.get('id'); // Replace with the actual user ID
  const url = `http://localhost:5000/characters/${userId}`;

  try {
    const payload = {};

    const name = formData.get('name');
    if (name.trim() !== '') {
      payload.name = name;
    }

    const description = formData.get('description');
    if (description.trim() !== '') {
      payload.description = description;
    }

    const imageFile = formData.get('file');
    if (imageFile) {
      console.log(imageFile)
      payload.image = imageFile;
    }
    // Add any other fields you want to update

    const params = new URLSearchParams(payload);

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (response.ok) {
      // console.log(payload);
      // Handle successful update
      // window.location.reload(true);
      window.location.replace(document.referrer);

    } else {
      const data = await response.json();
      console.log('Error updating user:', response.status, data.error);
    }
  } catch (error) {
    console.log('Error updating user:', error);
  }
});

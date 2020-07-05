var value = dropZone();

function dropZone() {
  const validate = img => img.kind === 'file' && img.type.match(/^image\/(png|jpeg)$/);
  const process = file => file.getAsFile();
  const urls = [];
  const area = document.getElementById('dropZone');
  const view = document.getElementById('dropZoneView');

  area.ondragover = e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  function getImage(items) {
    const value = (() => {
      for (const item of items) {
        if (!validate || validate(item)) {
          return process ? process(item) : item;
        }
      }
    })();
    if (value) {
      view.value = value;
      var fr = new FileReader();
      fr.onload = function () {
        document.getElementById('image').src = fr.result;
      }
      fr.readAsDataURL(value);
      setTimeout(() => view.dispatchEvent(new CustomEvent('input')), 100);
      area.blur();
    } else {
      area.classList.add('invalid');
      setTimeout(() => area.classList.remove('invalid'), 2000);
    }
  }

  area.ondrop = e => {
    e.preventDefault();
    getImage(e.dataTransfer.items);
  };

  area.onpaste = e => {
    getImage(e.clipboardData.items);
  };
  return view;
}

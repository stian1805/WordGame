import { useState, useRef, useCallback, useEffect } from 'react';
import './WordGame.css';

const TILE_WIDTH = 120;
const TILE_HEIGHT = 48;

function WordGame() {
  const [wordList, setWordList] = useState(['Fire', 'Water', 'Air', 'Earth']);
  const [search, setSearch] = useState('');
  const [canvasWords, setCanvasWords] = useState([]);
  const [dragging, setDragging] = useState(null); // { id, offsetX, offsetY }
  const [notification, setNotification] = useState(null); // { text, type }
  const [overDelete, setOverDelete] = useState(false);
  const nextId = useRef(0);
  const canvasRef = useRef(null);
  const deleteZoneRef = useRef(null);
  const canvasWordsRef = useRef(canvasWords);
  useEffect(() => { canvasWordsRef.current = canvasWords; }, [canvasWords]);

  const isOverDeleteZone = (clientX, clientY) => {
    const zone = deleteZoneRef.current;
    if (!zone) return false;
    const rect = zone.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  };

  const showNotification = (text, type = 'info') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const addWordToCanvas = (word) => {
    const canvas = canvasRef.current;
    const rect = canvas ? canvas.getBoundingClientRect() : { width: 600, height: 500 };
    const x = rect.width / 2 - TILE_WIDTH / 2 + (Math.random() - 0.5) * 160;
    const y = rect.height / 2 - TILE_HEIGHT / 2 + (Math.random() - 0.5) * 120;
    setCanvasWords((prev) => [
      ...prev,
      { id: nextId.current++, text: word, x, y },
    ]);
  };

  const handleMouseDown = (e, id) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const word = canvasWords.find((w) => w.id === id);
    if (!word) return;
    setDragging({
      id,
      offsetX: e.clientX - rect.left - word.x,
      offsetY: e.clientY - rect.top - word.y,
    });
  };

  const handleMouseMove = useCallback(
    (e) => {
      if (!dragging) return;
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left - dragging.offsetX;
      const y = e.clientY - rect.top - dragging.offsetY;
      setCanvasWords((prev) =>
        prev.map((w) => (w.id === dragging.id ? { ...w, x, y } : w))
      );
      setOverDelete(isOverDeleteZone(e.clientX, e.clientY));
    },
    [dragging]
  );

  const handleMouseUp = useCallback((e) => {
    if (!dragging) return;
    const currentDragging = dragging;
    setDragging(null);
    setOverDelete(false);

    if (e && isOverDeleteZone(e.clientX, e.clientY)) {
      setCanvasWords((cw) => cw.filter((w) => w.id !== currentDragging.id));
      return;
    }

    const prev = canvasWordsRef.current;
    const draggedWord = prev.find((w) => w.id === currentDragging.id);
    if (!draggedWord) return;

    const overlapping = prev.find((w) => {
      if (w.id === currentDragging.id) return false;
      return (
        draggedWord.x < w.x + TILE_WIDTH &&
        draggedWord.x + TILE_WIDTH > w.x &&
        draggedWord.y < w.y + TILE_HEIGHT &&
        draggedWord.y + TILE_HEIGHT > w.y
      );
    });

    if (!overlapping) return;

    const mergeX = (draggedWord.x + overlapping.x) / 2;
    const mergeY = (draggedWord.y + overlapping.y) / 2;
    const word1 = draggedWord.text;
    const word2 = overlapping.text;
    const removeIds = [currentDragging.id, overlapping.id];

    setCanvasWords((cw) => cw.filter((w) => !removeIds.includes(w.id)));

    fetch('http://localhost:5000/process-strings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ string1: word1, string2: word2 }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to process strings');
        return res.json();
      })
      .then((data) => {
        const resultWord = data.result;
        setWordList((wl) =>
          wl.includes(resultWord) ? wl : [...wl, resultWord]
        );
        setCanvasWords((cw) => [
          ...cw,
          { id: nextId.current++, text: resultWord, x: mergeX, y: mergeY },
        ]);
        showNotification(`${word1} + ${word2} = ${resultWord}`, 'success');
      })
      .catch((err) => {
        showNotification(err.message, 'error');
      });
  }, [dragging]);

  return (
    <div className="wordgame-container">
      <aside className="wordgame-sidebar">
        <h2 className="wordgame-sidebar-title">Words</h2>
        <input
          className="wordgame-search"
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ul className="wordgame-sidebar-list">
          {wordList
            .filter((w) => w.toLowerCase().includes(search.toLowerCase()))
            .map((word, index) => (
            <li
              key={index}
              className="wordgame-sidebar-item"
              onClick={() => addWordToCanvas(word)}
            >
              {word}
            </li>
          ))}
        </ul>
      </aside>

      <div
        className="wordgame-canvas"
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {canvasWords.map((word) => (
          <div
            key={word.id}
            className={`wordgame-tile${dragging?.id === word.id ? ' wordgame-tile--dragging' : ''}`}
            style={{ left: word.x, top: word.y }}
            onMouseDown={(e) => handleMouseDown(e, word.id)}
          >
            {word.text}
          </div>
        ))}

        {canvasWords.length === 0 && (
          <p className="wordgame-hint">Click a word on the left to place it here.<br />Drag two words onto each other to combine them.</p>
        )}

        {notification && (
          <div className={`wordgame-notification wordgame-notification--${notification.type}`}>
            {notification.text}
          </div>
        )}

        <div
          ref={deleteZoneRef}
          className={`wordgame-delete-zone${overDelete ? ' wordgame-delete-zone--active' : ''}`}
        >
          🗑 Remove
        </div>
      </div>
    </div>
  );
}

export default WordGame;
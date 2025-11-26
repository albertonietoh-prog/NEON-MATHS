import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Ghost, Coordinate, TileType, Direction, GhostMode, GameStatus, LevelData, MathQuestion, MathDifficulty } from './types';
import { 
    DEFAULT_LEVEL_STRING, 
    CELL_SIZE, 
    GAME_SPEED, 
    DIRECTION_OFFSETS, 
    OPPOSITE_DIRECTION,
    FRIGHTENED_DURATION,
    DIRECTIONS
} from './constants';
import { Board } from './components/Board';
import { generateLevel, generateMathQuestion } from './services/geminiService';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Wand2, Play, RefreshCw, Gamepad2, BrainCircuit, CheckCircle, XCircle, Trophy } from 'lucide-react';

// --- Helper Functions ---

const parseDefaultLevel = (): LevelData => {
    const map: string[][] = [];
    let pacmanStart: Coordinate = { x: 1, y: 1 };
    let ghostStart: Coordinate = { x: 1, y: 1 };
    let totalDots = 0;

    DEFAULT_LEVEL_STRING.forEach((rowStr, y) => {
        const row = rowStr.split('');
        const newRow: string[] = [];
        row.forEach((char, x) => {
            let tile = char;
            if (tile === 'S') {
                pacmanStart = { x, y };
                tile = TileType.EMPTY;
            } else if (tile === 'G') {
                ghostStart = { x, y };
                tile = TileType.EMPTY;
            } else if (tile === '.') {
                totalDots++;
            } else if (tile === 'o') {
                totalDots++;
            }
            newRow.push(tile);
        });
        map.push(newRow);
    });

    return { map, pacmanStart, ghostStart, totalDots };
};

const initialLevel = parseDefaultLevel();

const App: React.FC = () => {
    // --- State ---
    const [level, setLevel] = useState<LevelData>(initialLevel);
    // Store the original layout (with dots) to restore it for Level 2
    const [baseLevel, setBaseLevel] = useState<LevelData>(initialLevel);
    
    const [gameState, setGameState] = useState<GameStatus>(GameStatus.IDLE);
    const [score, setScore] = useState(0);
    const [lastQuizScore, setLastQuizScore] = useState(0);
    const [pacmanPos, setPacmanPos] = useState<Coordinate>(initialLevel.pacmanStart);
    const [pacmanDir, setPacmanDir] = useState<Direction>(Direction.NONE);
    const [nextDir, setNextDir] = useState<Direction>(Direction.NONE);
    
    // Quiz State
    const [currentQuestion, setCurrentQuestion] = useState<MathQuestion | null>(null);
    const [quizLoading, setQuizLoading] = useState(false);
    const [quizFeedback, setQuizFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [pastQuestions, setPastQuestions] = useState<string[]>([]);
    
    // Level Progression State
    const [mathDifficulty, setMathDifficulty] = useState<MathDifficulty>(MathDifficulty.LINEAR);
    const [levelCorrectAnswers, setLevelCorrectAnswers] = useState(0);

    const [ghosts, setGhosts] = useState<Ghost[]>([
        { id: 1, pos: initialLevel.ghostStart, startPos: initialLevel.ghostStart, color: '#ef4444', mode: GhostMode.SCATTER, direction: Direction.UP }, // Blinky (Red)
        { id: 2, pos: initialLevel.ghostStart, startPos: initialLevel.ghostStart, color: '#f472b6', mode: GhostMode.SCATTER, direction: Direction.DOWN }, // Pinky (Pink)
        { id: 3, pos: initialLevel.ghostStart, startPos: initialLevel.ghostStart, color: '#38bdf8', mode: GhostMode.SCATTER, direction: Direction.LEFT }, // Inky (Cyan)
        { id: 4, pos: initialLevel.ghostStart, startPos: initialLevel.ghostStart, color: '#fbbf24', mode: GhostMode.SCATTER, direction: Direction.RIGHT }, // Clyde (Orange)
    ]);

    const [frightenedTimer, setFrightenedTimer] = useState(0);
    const [mouthOpen, setMouthOpen] = useState(true);

    const gameLoopRef = useRef<number | null>(null);
    const prevPositionsRef = useRef({ pacman: pacmanPos, ghosts: ghosts });

    // --- Audio ---
    const audioCtxRef = useRef<AudioContext | null>(null);

    const playSound = useCallback((type: 'chomp' | 'power' | 'die' | 'win' | 'quiz_start' | 'quiz_correct' | 'quiz_wrong' | 'level_up') => {
        if (!audioCtxRef.current) {
             audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioCtxRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;

        if (type === 'chomp') {
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start();
            osc.stop(now + 0.1);
        } else if (type === 'power') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.linearRampToValueAtTime(1200, now + 0.3);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        } else if (type === 'die') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(500, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.5);
            osc.start();
            osc.stop(now + 0.5);
        } else if (type === 'quiz_start') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.linearRampToValueAtTime(880, now + 0.3);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.5);
            osc.start();
            osc.stop(now + 0.5);
        } else if (type === 'quiz_correct') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(523.25, now); // C5
            osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
            osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.4);
            osc.start();
            osc.stop(now + 0.4);
        } else if (type === 'quiz_wrong') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.3);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        } else if (type === 'level_up') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(554, now + 0.1);
            osc.frequency.setValueAtTime(659, now + 0.2);
            osc.frequency.setValueAtTime(880, now + 0.4);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 1.0);
            osc.start();
            osc.stop(now + 1.0);
        }
    }, []);

    // --- Logic Helpers ---
    
    const isValidMove = useCallback((pos: Coordinate, dir: Direction): boolean => {
        const offset = DIRECTION_OFFSETS[dir];
        const nextX = pos.x + offset.x;
        const nextY = pos.y + offset.y;
        
        // Bounds check
        if (nextY < 0 || nextY >= level.map.length) return false;
        
        // Wrap around X
        let checkX = nextX;
        if (checkX < 0) checkX = level.map[0].length - 1;
        if (checkX >= level.map[0].length) checkX = 0;

        const tile = level.map[nextY][checkX];
        return tile !== TileType.WALL;
    }, [level]);

    const getNextPos = (pos: Coordinate, dir: Direction): Coordinate => {
        const offset = DIRECTION_OFFSETS[dir];
        let nextX = pos.x + offset.x;
        let nextY = pos.y + offset.y;
        
        // Wrap
        if (nextX < 0) nextX = level.map[0].length - 1;
        if (nextX >= level.map[0].length) nextX = 0;

        return { x: nextX, y: nextY };
    };

    const handleInput = useCallback((key: string) => {
        if (gameState !== GameStatus.PLAYING) return;
        
        switch (key) {
            case 'ArrowUp': case 'w': setNextDir(Direction.UP); break;
            case 'ArrowDown': case 's': setNextDir(Direction.DOWN); break;
            case 'ArrowLeft': case 'a': setNextDir(Direction.LEFT); break;
            case 'ArrowRight': case 'd': setNextDir(Direction.RIGHT); break;
        }
    }, [gameState]);

    // --- Actions ---

    const resetLevel = () => {
        // Reset to the original base layout (full dots) using a Deep Copy
        // This ensures subsequent resets don't inherit eaten dots
        const freshLevel = JSON.parse(JSON.stringify(baseLevel));
        setLevel(freshLevel);
        setPacmanPos(freshLevel.pacmanStart);
        setGhosts(prev => prev.map(g => ({ ...g, pos: freshLevel.ghostStart, mode: GhostMode.SCATTER })));
        setScore(0);
        setLastQuizScore(0);
        setPastQuestions([]); 
        setLevelCorrectAnswers(0);
        setMathDifficulty(MathDifficulty.LINEAR);
    };

    const startGame = () => {
        // If coming from Game Over or Victory, reset logic is handled by "Try Again" or "Play Again" buttons usually
        // But if start is clicked from IDLE after a reset, just switch state
        setGameState(GameStatus.PLAYING);
        setPacmanDir(Direction.RIGHT);
        setNextDir(Direction.RIGHT);
    };

    const handleTryAgain = () => {
        resetLevel();
        setGameState(GameStatus.IDLE);
    };

    const startNextLevelSameMaze = () => {
        // Restore the map layout with dots from baseLevel (Deep Copy)
        const freshLevel = JSON.parse(JSON.stringify(baseLevel));
        setLevel(freshLevel);
        // Reset positions
        setPacmanPos(freshLevel.pacmanStart);
        setGhosts(prev => prev.map(g => ({ ...g, pos: freshLevel.ghostStart, mode: GhostMode.SCATTER })));
        
        // Reset quiz progress for the new level loop, but KEEP Score and difficulty
        setLevelCorrectAnswers(0);
        setGameState(GameStatus.IDLE);
    };
    
    const handleGenerateLevel = async () => {
        try {
            setGameState(GameStatus.GENERATING_LEVEL);
            const newLevelData = await generateLevel();
            setLevel(newLevelData);
            setBaseLevel(newLevelData); // Update base level to the new AI generated one
            setPacmanPos(newLevelData.pacmanStart);
            setGhosts(prev => prev.map(g => ({ ...g, pos: newLevelData.ghostStart, startPos: newLevelData.ghostStart })));
            setScore(0);
            setLastQuizScore(0);
            setPastQuestions([]); 
            setLevelCorrectAnswers(0);
            
            if (gameState !== GameStatus.LEVEL_TRANSITION && gameState !== GameStatus.VICTORY) {
                 setMathDifficulty(MathDifficulty.LINEAR);
            }
            
            setGameState(GameStatus.IDLE);
        } catch (e) {
            alert("Failed to generate level. Please check API Key.");
            setGameState(GameStatus.IDLE);
        }
    };

    // --- Quiz Logic ---
    const triggerQuiz = async () => {
        setGameState(GameStatus.QUIZ);
        setQuizLoading(true);
        playSound('quiz_start');
        try {
            const question = await generateMathQuestion(pastQuestions, mathDifficulty);
            setCurrentQuestion(question);
            setPastQuestions(prev => [...prev, question.question]);
        } catch (e) {
            console.error("Quiz failed", e);
            setGameState(GameStatus.PLAYING);
        } finally {
            setQuizLoading(false);
        }
    };

    const handleQuizAnswer = (index: number) => {
        if (!currentQuestion) return;
        if (quizFeedback !== null) return; // Prevent multiple clicks

        if (index === currentQuestion.correctIndex) {
            setQuizFeedback('correct');
            playSound('quiz_correct');
            
            // Logic for level progression
            const newCorrectCount = levelCorrectAnswers + 1;
            setLevelCorrectAnswers(newCorrectCount);

            setTimeout(() => {
                setQuizFeedback(null);
                setCurrentQuestion(null);
                
                if (newCorrectCount >= 3) {
                    if (mathDifficulty === MathDifficulty.LINEAR) {
                        // Level Up to Quadratic
                        setGameState(GameStatus.LEVEL_TRANSITION);
                        playSound('level_up');
                        // Trigger next level with SAME maze but Harder Math
                        setTimeout(() => {
                             setMathDifficulty(MathDifficulty.QUADRATIC);
                             startNextLevelSameMaze();
                        }, 3000);
                    } else {
                        // MathDifficulty.QUADRATIC and 3 answers correct
                        // Final Victory
                        setGameState(GameStatus.VICTORY);
                        playSound('win');
                    }
                } else {
                    setGameState(GameStatus.PLAYING);
                }
            }, 1000);
        } else {
            setQuizFeedback('incorrect');
            playSound('quiz_wrong');
            // If incorrect, show red, wait 2 seconds, then CLOSE quiz and resume game
            // No retry allowed.
            setTimeout(() => {
                setQuizFeedback(null);
                setCurrentQuestion(null);
                setGameState(GameStatus.PLAYING);
            }, 2000);
        }
    };

    // --- Game Engine ---

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ([32, 37, 38, 39, 40].indexOf(e.keyCode) > -1) {
                e.preventDefault();
            }
            handleInput(e.key);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleInput]);

    useEffect(() => {
        if (gameState !== GameStatus.PLAYING) {
            if (gameLoopRef.current) clearInterval(gameLoopRef.current);
            return;
        }

        const tick = () => {
            // 1. Move Pacman
            setPacmanPos(prev => {
                let moveDir = pacmanDir;
                if (nextDir !== Direction.NONE && isValidMove(prev, nextDir)) {
                    moveDir = nextDir;
                    setPacmanDir(nextDir);
                } else if (!isValidMove(prev, moveDir)) {
                    return prev;
                }
                const newPos = getNextPos(prev, moveDir);
                setPacmanDir(moveDir);
                return newPos;
            });

            setMouthOpen(m => !m);

            // 2. Move Ghosts
            setGhosts(prevGhosts => prevGhosts.map(ghost => {
                if (ghost.mode === GhostMode.EATEN) {
                     if (ghost.pos.x === ghost.startPos.x && ghost.pos.y === ghost.startPos.y) {
                         return { ...ghost, mode: GhostMode.CHASE };
                     }
                }

                const options = DIRECTIONS.filter(d => 
                    d !== OPPOSITE_DIRECTION[ghost.direction] && isValidMove(ghost.pos, d)
                );

                if (options.length === 0) {
                     const reverse = OPPOSITE_DIRECTION[ghost.direction];
                     if(isValidMove(ghost.pos, reverse)) options.push(reverse);
                     else options.push(Direction.NONE);
                }

                const chosenDir = options[Math.floor(Math.random() * options.length)];
                return { ...ghost, pos: getNextPos(ghost.pos, chosenDir), direction: chosenDir };
            }));

            // 3. Frightened Timer
            if (frightenedTimer > 0) {
                setFrightenedTimer(t => {
                   if (t === 1) {
                       setGhosts(gs => gs.map(g => g.mode === GhostMode.FRIGHTENED ? { ...g, mode: GhostMode.CHASE } : g));
                   }
                   return t - 1;
                });
            }
        };

        gameLoopRef.current = window.setInterval(tick, GAME_SPEED);
        return () => {
            if (gameLoopRef.current) clearInterval(gameLoopRef.current);
        };
    }, [gameState, pacmanDir, nextDir, level, isValidMove, frightenedTimer]);

    // --- Collision & Game State Checks ---
    useEffect(() => {
        if (gameState !== GameStatus.PLAYING) return;

        const prevPacman = prevPositionsRef.current.pacman;
        const prevGhosts = prevPositionsRef.current.ghosts;

        // 1. Check Collisions with items
        const currentTile = level.map[pacmanPos.y][pacmanPos.x];
        if (currentTile === TileType.DOT) {
            playSound('chomp');
            setScore(s => s + 10);
            setLevel(prev => {
                const newMap = [...prev.map];
                const newRow = [...newMap[pacmanPos.y]]; // Shallow copy of row
                newRow[pacmanPos.x] = TileType.EMPTY;
                newMap[pacmanPos.y] = newRow;
                return { ...prev, map: newMap };
            });
        } else if (currentTile === TileType.POWER_PELLET) {
            playSound('power');
            setScore(s => s + 50);
            setFrightenedTimer(FRIGHTENED_DURATION);
            setGhosts(gs => gs.map(g => ({ ...g, mode: GhostMode.FRIGHTENED })));
            setLevel(prev => {
                const newMap = [...prev.map];
                const newRow = [...newMap[pacmanPos.y]]; // Shallow copy of row
                newRow[pacmanPos.x] = TileType.EMPTY;
                newMap[pacmanPos.y] = newRow;
                return { ...prev, map: newMap };
            });
        }

        // 2. Check Entity Collisions
        ghosts.forEach(ghost => {
            const isColliding = ghost.pos.x === pacmanPos.x && ghost.pos.y === pacmanPos.y;
            const prevGhost = prevGhosts.find(g => g.id === ghost.id);
            const isSwapColliding = prevGhost && 
                ghost.pos.x === prevPacman.x && ghost.pos.y === prevPacman.y &&
                prevGhost.pos.x === pacmanPos.x && prevGhost.pos.y === pacmanPos.y;

            if (isColliding || isSwapColliding) {
                if (ghost.mode === GhostMode.FRIGHTENED) {
                    playSound('chomp');
                    setScore(s => s + 200);
                    setGhosts(gs => gs.map(g => g.id === ghost.id ? { ...g, mode: GhostMode.EATEN, pos: g.startPos } : g));
                } else if (ghost.mode !== GhostMode.EATEN) {
                    playSound('die');
                    setGameState(GameStatus.GAME_OVER);
                }
            }
        });

        // 3. Check Win (Maze Cleared)
        let dotsRemaining = 0;
        level.map.forEach(row => row.forEach(tile => {
            if (tile === TileType.DOT || tile === TileType.POWER_PELLET) dotsRemaining++;
        }));
        if (dotsRemaining === 0) {
            playSound('win');
            setGameState(GameStatus.VICTORY);
        }

        prevPositionsRef.current = { pacman: pacmanPos, ghosts };

    }, [pacmanPos, ghosts, level, gameState, playSound]);

    // Check for Quiz Threshold
    useEffect(() => {
        if (score > 0 && score >= lastQuizScore + 500 && gameState === GameStatus.PLAYING) {
            setLastQuizScore(prev => prev + 500);
            triggerQuiz();
        }
    }, [score, lastQuizScore, gameState]);


    return (
        <div className="h-screen w-full bg-slate-950 overflow-hidden flex flex-col items-center justify-center p-2 sm:p-4">
            <div className="max-w-[800px] w-full flex flex-col items-center gap-4 sm:gap-6 scale-90 sm:scale-100 origin-center transition-transform">
                
                {/* Header */}
                <div className="flex flex-col items-center gap-2 sm:gap-4 mb-2">
                    <div className="flex flex-col items-center">
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-retro text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-sky-300 drop-shadow-[0_0_10px_rgba(56,189,248,0.5)] tracking-wider text-center">
                            NEON PAC-MAN
                        </h1>
                        <span className="text-slate-400 font-bold tracking-widest text-[10px] sm:text-xs mt-2 uppercase">
                            EDICIÓN COLEGIO ABECÉ
                        </span>
                    </div>
                    
                    <div className="flex gap-4 sm:gap-8 font-retro text-xs sm:text-base mt-2 bg-slate-900 px-4 sm:px-6 py-2 rounded-full border border-slate-800 shadow-lg shadow-blue-900/20">
                        <div className="text-slate-300 font-bold">SCORE: <span className="text-yellow-400">{score}</span></div>
                        <div className="text-slate-400">NEXT QUIZ: <span className="text-purple-400">{lastQuizScore + 500}</span></div>
                    </div>
                    
                    <div className="text-[10px] sm:text-xs font-mono text-slate-500">
                        DIFFICULTY: {mathDifficulty === MathDifficulty.LINEAR ? 'PRIMER GRADO' : 'SEGUNDO GRADO'} | PROGRESS: {levelCorrectAnswers}/3
                    </div>
                </div>

                {/* Game Area */}
                <div className="relative group shadow-2xl">
                    <Board 
                        map={level.map} 
                        pacmanPos={pacmanPos} 
                        pacmanDir={pacmanDir} 
                        ghosts={ghosts} 
                        isMouthOpen={mouthOpen}
                    />
                    
                    {/* Overlays */}
                    {gameState === GameStatus.IDLE && (
                        <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center rounded-lg backdrop-blur-sm z-30">
                            <button 
                                onClick={startGame}
                                className="group relative px-6 py-3 sm:px-8 sm:py-4 bg-yellow-400 hover:bg-yellow-300 text-black font-retro text-lg sm:text-xl rounded-md transition-all hover:scale-105 hover:shadow-[0_0_20px_#facc15]"
                            >
                                <Play className="inline-block mr-2 w-5 h-5 sm:w-6 sm:h-6 mb-1" />
                                {score > 0 ? "CONTINUE" : "START GAME"}
                            </button>
                        </div>
                    )}
                    
                    {gameState === GameStatus.GAME_OVER && (
                        <div className="absolute inset-0 bg-red-900/80 flex flex-col items-center justify-center rounded-lg backdrop-blur-sm z-30 animate-in fade-in zoom-in duration-300">
                            <h2 className="text-3xl sm:text-5xl font-retro text-white mb-6 sm:mb-8 drop-shadow-[0_0_10px_red]">GAME OVER</h2>
                             <button 
                                onClick={handleTryAgain}
                                className="px-5 py-2 sm:px-6 sm:py-3 bg-white text-red-600 font-retro rounded hover:bg-gray-200 transition-colors"
                            >
                                TRY AGAIN
                            </button>
                        </div>
                    )}

                    {gameState === GameStatus.VICTORY && (
                        <div className="absolute inset-0 bg-green-900/90 flex flex-col items-center justify-center rounded-lg backdrop-blur-sm z-30 text-center animate-in fade-in zoom-in duration-500 p-4 sm:p-8">
                            {/* Special Condition for Math Victory Level 2 */}
                            {mathDifficulty === MathDifficulty.QUADRATIC && levelCorrectAnswers >= 3 ? (
                                <>
                                    <Trophy className="w-20 h-20 sm:w-32 sm:h-32 text-yellow-300 animate-bounce mb-4 sm:mb-6 drop-shadow-[0_0_20px_#facc15]" />
                                    <h2 className="text-xl sm:text-2xl md:text-4xl font-retro text-white mb-4 sm:mb-6 leading-tight drop-shadow-md">
                                        ¡ENHORABUENA!
                                    </h2>
                                    <p className="text-lg sm:text-xl md:text-3xl font-bold text-yellow-200 mb-6 sm:mb-8 font-retro leading-relaxed">
                                        ¡ALBERTO TE VA A PONER 3 POSITIVOS!
                                    </p>
                                    <button 
                                        onClick={handleTryAgain}
                                        className="px-6 py-3 sm:px-8 sm:py-4 bg-white text-green-700 font-bold rounded-full hover:scale-105 transition-transform shadow-lg font-retro text-sm sm:text-base"
                                    >
                                        VOLVER AL INICIO
                                    </button>
                                </>
                            ) : (
                                <>
                                    {/* Standard Maze Clear Victory */}
                                    <h2 className="text-4xl sm:text-5xl font-retro text-green-300 mb-8 drop-shadow-[0_0_10px_#4ade80]">VICTORY!</h2>
                                    <button 
                                        onClick={startNextLevelSameMaze}
                                        className="px-6 py-3 bg-green-400 text-black font-retro rounded hover:bg-green-300 transition-colors"
                                    >
                                        PLAY AGAIN (SAME MAZE)
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {gameState === GameStatus.LEVEL_TRANSITION && (
                        <div className="absolute inset-0 bg-indigo-900/90 flex flex-col items-center justify-center rounded-lg backdrop-blur-sm z-50 animate-in fade-in zoom-in duration-500 p-4">
                             <Trophy className="w-16 h-16 sm:w-24 sm:h-24 text-yellow-400 animate-bounce mb-6 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]" />
                            <h2 className="text-2xl sm:text-4xl font-retro text-white mb-4 drop-shadow-md text-center">NIVEL SUPERADO</h2>
                            <p className="text-indigo-200 font-bold mb-8 text-lg sm:text-xl text-center">DESBLOQUEANDO ECUACIONES DE 2º GRADO...</p>
                        </div>
                    )}

                     {gameState === GameStatus.GENERATING_LEVEL && (
                        <div className="absolute inset-0 bg-purple-900/90 flex flex-col items-center justify-center rounded-lg backdrop-blur-sm z-30">
                            <RefreshCw className="w-12 h-12 sm:w-16 sm:h-16 text-purple-300 animate-spin mb-4" />
                            <h2 className="text-lg sm:text-xl font-retro text-purple-200">GENERATING MAZE...</h2>
                            <p className="text-xs text-purple-400 mt-2 font-mono">Powered by Gemini 2.5 Flash</p>
                        </div>
                    )}

                    {/* QUIZ OVERLAY */}
                    {gameState === GameStatus.QUIZ && (
                        <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center rounded-lg backdrop-blur-sm z-40 p-4 sm:p-6 text-center border-4 border-blue-500 shadow-[0_0_50px_rgba(59,130,246,0.5)]">
                            {quizLoading ? (
                                <>
                                    <BrainCircuit className="w-12 h-12 sm:w-16 sm:h-16 text-blue-400 animate-pulse mb-4" />
                                    <h2 className="text-xl sm:text-2xl font-retro text-blue-200 mb-2">GENERATING CHALLENGE...</h2>
                                    <p className="text-blue-400 text-sm sm:text-base">
                                        {mathDifficulty === MathDifficulty.QUADRATIC ? 'Desafío: Ecuaciones 2º Grado' : 'Desafío: Ecuaciones 1er Grado'}
                                    </p>
                                </>
                            ) : currentQuestion ? (
                                <div className="w-full max-w-md animate-in slide-in-from-bottom-10 fade-in duration-500">
                                    <div className="mb-4 sm:mb-6">
                                        <h2 className="text-lg sm:text-2xl font-bold text-white mb-2">RESOLVER ECUACIÓN</h2>
                                        <div className="bg-slate-800 p-3 sm:p-4 rounded-lg border border-slate-600 shadow-inner">
                                            <p className="text-2xl sm:text-3xl font-mono text-yellow-400">{currentQuestion.question}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                        {currentQuestion.options.map((option, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleQuizAnswer(idx)}
                                                className={`
                                                    p-3 sm:p-4 rounded-lg font-bold text-base sm:text-lg transition-all border-2
                                                    ${quizFeedback === null 
                                                        ? 'bg-slate-700 border-slate-600 hover:bg-blue-600 hover:border-blue-400 text-white' 
                                                        : idx === currentQuestion.correctIndex 
                                                            ? 'bg-green-600 border-green-400 text-white shadow-[0_0_15px_rgba(74,222,128,0.5)] scale-105'
                                                            : 'bg-slate-700 border-slate-700 text-slate-500 opacity-50'
                                                    }
                                                    ${quizFeedback === 'incorrect' && 'animate-shake'}
                                                `}
                                                disabled={quizFeedback !== null}
                                            >
                                                {option}
                                                {quizFeedback === 'correct' && idx === currentQuestion.correctIndex && (
                                                    <CheckCircle className="inline-block ml-2 w-4 h-4 sm:w-5 sm:h-5 mb-1" />
                                                )}
                                                {quizFeedback === 'incorrect' && idx !== currentQuestion.correctIndex && quizFeedback === null && (
                                                    <XCircle className="inline-block ml-2 w-4 h-4 sm:w-5 sm:h-5 mb-1" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                    
                                    {quizFeedback === 'correct' && (
                                        <p className="mt-4 text-green-400 font-retro animate-bounce">CORRECT! +1 PROGRESS</p>
                                    )}
                                    {quizFeedback === 'incorrect' && (
                                        <p className="mt-4 text-red-400 font-retro animate-pulse">INCORRECT!</p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-red-500">Error loading question.</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="w-full max-w-lg flex flex-col md:flex-row items-center justify-between gap-4">
                    
                    {/* D-Pad for Mobile */}
                    <div className="md:hidden grid grid-cols-3 gap-2">
                        <div />
                        <button onPointerDown={() => handleInput('ArrowUp')} className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-800 rounded-lg flex items-center justify-center active:bg-slate-700 shadow-lg border-b-4 border-slate-950 active:border-b-0 active:translate-y-1"><ArrowUp className="text-white" /></button>
                        <div />
                        <button onPointerDown={() => handleInput('ArrowLeft')} className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-800 rounded-lg flex items-center justify-center active:bg-slate-700 shadow-lg border-b-4 border-slate-950 active:border-b-0 active:translate-y-1"><ArrowLeft className="text-white" /></button>
                        <button onPointerDown={() => handleInput('ArrowDown')} className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-800 rounded-lg flex items-center justify-center active:bg-slate-700 shadow-lg border-b-4 border-slate-950 active:border-b-0 active:translate-y-1"><ArrowDown className="text-white" /></button>
                        <button onPointerDown={() => handleInput('ArrowRight')} className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-800 rounded-lg flex items-center justify-center active:bg-slate-700 shadow-lg border-b-4 border-slate-950 active:border-b-0 active:translate-y-1"><ArrowRight className="text-white" /></button>
                    </div>

                    {/* AI Button */}
                    <div className="flex flex-col gap-2 w-full md:w-auto mt-2 md:mt-0">
                        <button 
                            onClick={handleGenerateLevel}
                            disabled={gameState === GameStatus.PLAYING}
                            className={`
                                flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all w-full
                                ${gameState === GameStatus.PLAYING 
                                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
                                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-[0_0_15px_rgba(124,58,237,0.4)]'}
                            `}
                        >
                            <Wand2 className="w-5 h-5" />
                            <span className="text-sm sm:text-base">GENERATE NEW MAZE</span>
                        </button>
                         <p className="text-[10px] sm:text-xs text-slate-500 text-center">
                            Use Arrow Keys or WASD to move.
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default App;
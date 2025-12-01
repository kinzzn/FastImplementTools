import React, { useState, useEffect, useCallback, memo } from 'react';
import { v4 as uuidv4 } from 'uuid'; // 引入 uuid 用于生成唯一ID

// ------------------------- 1. 类型定义 -------------------------

// 专辑数据结构
interface Album {
    id: string;
    title: string;
    artist: string;
}

// 专辑池类型
type AlbumPool = Album[];

// 对决配对类型：第二个元素可能是null，代表轮空
type DuelPair = [Album, Album | null];
type DuelPairs = DuelPair[];

// 阶段枚举
enum STAGE {
    INPUT = 'input',
    DUEL = 'duel',
    RESULT = 'result',
}

// ------------------------- 2. DuelArena 辅助函数 -------------------------

/**
 * 随机配对函数：将数组元素两两分组
 * @param arr - 待分组的专辑数组
 * @returns - [[A, B], [C, D], ...]
 */
const pairAlbums = (arr: AlbumPool): DuelPairs => {
    // 随机打乱数组
    const shuffled: AlbumPool = [...arr].sort(() => 0.5 - Math.random());
    const pairs: DuelPairs = [];
    
    for (let i = 0; i < shuffled.length; i += 2) {
        if (shuffled[i + 1]) {
            pairs.push([shuffled[i], shuffled[i + 1]]);
        } else {
            // 如果是奇数个，最后一个直接晋级 (轮空)
            pairs.push([shuffled[i], null]); 
        }
    }
    return pairs;
};


// ------------------------- 3. ResultList 组件 -------------------------

interface ResultListProps {
    albums: AlbumPool;
}

function ResultList({ albums }: ResultListProps): JSX.Element {
    
    const top10: AlbumPool = albums.slice(0, 10);
    
    const handleCopy = (): void => {
        const resultText: string = top10.map((a, i) => `${i + 1}. ${a.title} - ${a.artist}`).join('\n');
        
        // 使用 document.execCommand('copy') 实现剪贴板复制
        try {
             const textarea = document.createElement('textarea');
             textarea.value = resultText;
             // 使其不可见但可选中
             textarea.style.position = 'fixed';
             textarea.style.opacity = '0';
             document.body.appendChild(textarea);
             textarea.focus();
             textarea.select();
             document.execCommand('copy');
             document.body.removeChild(textarea);
             console.log("结果已复制到剪贴板！");
        } catch (err) {
            console.error('无法复制到剪贴板:', err);
        }
    }

    return (
        <div className="p-6 bg-green-50 rounded-xl shadow-2xl mt-8">
            <h2 className="text-3xl font-bold text-green-700 mb-6">🌟 您的年度十大专辑！</h2>
            <ol className="list-decimal pl-5 space-y-3">
                {top10.map((album, index) => (
                    <li 
                        key={album.id} 
                        className="text-xl font-medium p-2 bg-white rounded-lg shadow-md hover:bg-green-100 transition duration-150"
                    >
                        <span className="font-extrabold mr-2 text-green-600">#{index + 1}</span>
                        {album.title} 
                        <span className="text-gray-500 ml-3 text-base">— {album.artist}</span>
                    </li>
                ))}
            </ol>
            <button 
                className="mt-6 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition duration-200"
                onClick={handleCopy}
            >
                复制结果到剪贴板
            </button>
        </div>
    );
}

// ------------------------- 4. DuelArena 组件 -------------------------

// 辅助组件：展示专辑卡片
interface AlbumCardProps {
    album: Album;
    onSelect: (album: Album) => void;
}
const AlbumCard = memo(({ album, onSelect }: AlbumCardProps): JSX.Element => (
    <div 
        className="w-1/2 p-4 border-2 border-transparent rounded-xl cursor-pointer transition-all duration-300 hover:shadow-2xl hover:border-blue-500 transform hover:scale-[1.02] bg-white"
        onClick={() => onSelect(album)}
    >
        <div className="w-full h-40 bg-gray-200 flex items-center justify-center text-gray-500 text-sm mb-3 rounded-lg shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
            </svg>
        </div>
        <h3 className="font-bold text-xl text-center truncate text-gray-800">{album.title}</h3>
        <p className="text-sm text-gray-500 text-center mt-1">{album.artist}</p>
        <p className="mt-3 text-center text-blue-600 font-semibold text-base">点击选择 &raquo;</p>
    </div>
));


interface DuelArenaProps {
    albums: AlbumPool;
    onPoolUpdate: (newPool: AlbumPool) => void;
    onFinish: () => void;
    targetSize: number;
}

function DuelArena({ albums, onPoolUpdate, onFinish, targetSize }: DuelArenaProps): JSX.Element {
    const [currentPairs, setCurrentPairs] = useState<DuelPairs>([]);
    const [winners, setWinners] = useState<AlbumPool>([]);
    const [round, setRound] = useState<number>(1);
    
    // 初始化或进入新一轮时运行
    useEffect(() => {
        if (albums.length <= targetSize) {
            onFinish();
            return;
        }

        // 只有当对决列表为空，且当前专辑池大于目标大小时，才开始新的一轮配对
        if (currentPairs.length === 0) {
            setCurrentPairs(pairAlbums(albums));
            setWinners([]); // 新一轮，清空胜者
            console.log(`Round ${round} Starts. Albums: ${albums.length}. Duels: ${Math.ceil(albums.length / 2)}`);
        }
    }, [albums, targetSize, onFinish, round, currentPairs.length]);


    // 处理用户点击选择
    const handleSelectWinner = useCallback((winner: Album) => {
        // 1. 将胜者加入本轮晋级者列表
        const newWinners = [...winners, winner]; 
        
        // 2. 从当前配对列表中移除已完成的对决
        const nextPairs = currentPairs.slice(1);
        
        setWinners(newWinners);
        setCurrentPairs(nextPairs);
        
        // 3. 检查本轮是否结束
        if (nextPairs.length === 0) {
            console.log(`Round ${round} Finished. Winners: ${newWinners.length}`);
            
            // 4. 进入下一轮逻辑
            if (newWinners.length <= targetSize) {
                // 达到目标，完成
                onPoolUpdate(newWinners.slice(0, targetSize));
                onFinish();
            } else {
                // 继续下一轮
                setRound(r => r + 1);
                // 关键：更新 App.js 中的 currentPool，触发 App 中的 useEffect，开始下一轮
                onPoolUpdate(newWinners); 
            }
        }
    }, [winners, currentPairs, onFinish, onPoolUpdate, targetSize, round]);


    if (albums.length <= targetSize) {
        return <p className="text-xl text-green-600 font-bold">🎉 评选完成！请查看结果。</p>;
    }
    
    // 获取当前对决的两张专辑
    const currentDuel = currentPairs[0];
    const albumA: Album | null = currentDuel ? currentDuel[0] : null;
    const albumB: Album | null = currentDuel ? currentDuel[1] : null;

    if (!albumA) return <p className="text-center text-gray-500 py-10">正在准备下一轮对决...</p>; 

    return (
        <div className="bg-white p-6 rounded-xl shadow-2xl border-t-4 border-indigo-500">
            <h2 className="text-3xl font-bold mb-4 text-gray-800">
                🚀 第 {round} 轮对决
                <span className="text-base ml-3 text-gray-500">
                    (剩余 {albums.length} 选 {Math.ceil(albums.length / 2)} 晋级)
                </span>
            </h2>
            <p className="mb-6 text-lg text-gray-600">请选择您更喜欢的一张专辑，它将晋级到下一轮！</p>

            <div className="flex justify-around items-stretch space-x-6">
                
                {/* 专辑 A */}
                <AlbumCard 
                    album={albumA} 
                    onSelect={handleSelectWinner} 
                />
                
                <div className="flex flex-col items-center justify-center">
                    <span className="text-5xl font-extrabold text-red-500 animate-pulse">VS</span>
                    <span className="text-sm text-gray-400 mt-1">选择最爱</span>
                </div>

                {/* 专辑 B 或 轮空 */}
                {albumB ? (
                    <AlbumCard 
                        album={albumB} 
                        onSelect={handleSelectWinner} 
                    />
                ) : (
                    <div className="p-8 border-4 border-dashed border-yellow-400 bg-yellow-50/50 w-1/2 text-center rounded-xl flex flex-col justify-center items-center shadow-inner">
                        <p className="text-xl font-bold text-yellow-700 mb-4">**轮空 (Bye)**</p>
                        <button 
                            className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-5 rounded-full shadow-md transition duration-200"
                            onClick={() => handleSelectWinner(albumA)}
                        >
                            {albumA.title} 直接晋级 &raquo;
                        </button>
                    </div>
                )}
            </div>
            <div className="mt-8 pt-4 border-t border-gray-200 text-sm text-gray-500">
                <p>本轮进度：<span className="font-semibold text-gray-700">{winners.length}</span> / {currentPairs.length + winners.length} 场已完成。</p>
            </div>
        </div>
    );
}


// ------------------------- 5. AlbumInput 组件 -------------------------

interface AlbumInputProps {
    onSubmit: (albums: AlbumPool) => void;
}

function AlbumInput({ onSubmit }: AlbumInputProps): JSX.Element {
    const [inputText, setInputText] = useState<string>(
        "专辑一 - 艺人A\n专辑二 - 艺人B\n专辑三 - 艺人C\n专辑四 - 艺人D\n专辑五 - 艺人E\n专辑六 - 艺人F\n专辑七 - 艺人G\n专辑八 - 艺人H\n专辑九 - 艺人I\n专辑十 - 艺人J\n专辑十一 - 艺人K\n专辑十二 - 艺人L\n专辑十三 - 艺人M"
    );

    const handleSubmit = (): void => {
        // 1. 按行分割
        const lines: string[] = inputText.split('\n').filter(line => line.trim() !== '');
        
        // 2. 解析数据并结构化
        const albums: AlbumPool = lines.map(line => {
            // 假设格式为 "标题 - 艺人"
            const parts: string[] = line.split('-').map(p => p.trim());
            
            return {
                id: uuidv4(),
                title: parts[0] || '未知专辑',
                artist: parts[1] || '未知艺人',
            } as Album;
        });

        onSubmit(albums);
    };

    return (
        <div className="p-6 bg-white rounded-xl shadow-lg border-b-4 border-indigo-400">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">📋 步骤一：录入所有专辑 (至少 11 张)</h2>
            <p className="mb-4 text-sm text-gray-600">请将您听过的专辑按 **专辑名 - 艺人名** 的格式，每行一个，粘贴在下方：</p>
            <textarea
                className="w-full p-3 border border-gray-300 rounded-lg resize-y focus:ring-2 focus:ring-indigo-500 transition duration-150"
                rows={12}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="专辑名 - 艺人名\n另一张专辑 - 另一个艺人"
            />
            <button 
                className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200 shadow-lg shadow-indigo-200"
                onClick={handleSubmit}
            >
                开始对决淘汰 &raquo;
            </button>
        </div>
    );
}


// ------------------------- 6. 主应用组件 -------------------------

const TARGET_TOP_SIZE = 10;

export default function App(): JSX.Element {
    const [allAlbums, setAllAlbums] = useState<AlbumPool>([]);
    const [currentPool, setCurrentPool] = useState<AlbumPool>([]);
    const [currentStage, setCurrentStage] = useState<STAGE>(STAGE.INPUT);
    
    // Step 1: 录入完成后，初始化对决池并进入 DUEL 阶段
    const handleInputSubmit = (albums: AlbumPool): void => {
        if (albums.length < TARGET_TOP_SIZE + 1) {
            console.error(`专辑数量必须大于 ${TARGET_TOP_SIZE} 张才能开始评选，请添加更多。`);
            return;
        }
        setAllAlbums(albums);
        setCurrentPool(albums);
        setCurrentStage(STAGE.DUEL);
    };

    const handleRestart = (): void => {
        setAllAlbums([]);
        setCurrentPool([]);
        setCurrentStage(STAGE.INPUT);
    };

    const appStyles: React.CSSProperties = {
        minHeight: '100vh',
        fontFamily: 'Inter, sans-serif',
        backgroundColor: '#f1f5f9' // Tailwind's slate-100
    };
    
    return (
        <div style={appStyles} className="w-full max-w-5xl mx-auto p-4 md:p-8">
            <header className="w-full text-center py-8 bg-white shadow-md rounded-b-xl mb-8">
                <h1 className="text-4xl font-extrabold text-indigo-700 mb-2">🏆 年度十大专辑评选平台</h1>
                <p className="text-lg text-gray-500">挑选模式：**两两对决淘汰制**</p>
            </header>
            
            <main className="w-full">
                {currentStage === STAGE.INPUT && (
                    <AlbumInput onSubmit={handleInputSubmit} />
                )}

                {currentStage === STAGE.DUEL && currentPool.length > TARGET_TOP_SIZE && (
                    <DuelArena
                        albums={currentPool}
                        onPoolUpdate={setCurrentPool} 
                        onFinish={() => setCurrentStage(STAGE.RESULT)}
                        targetSize={TARGET_TOP_SIZE}
                    />
                )}

                {currentStage === STAGE.RESULT && (
                    <ResultList albums={currentPool} />
                )}
                
                {currentStage !== STAGE.INPUT && (
                    <div className="flex justify-center">
                        <button 
                            className="mt-8 text-blue-600 hover:text-blue-800 font-medium py-3 px-6 rounded-full transition duration-200 border border-blue-200 bg-white shadow-lg flex items-center" 
                            onClick={handleRestart}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-7-9a1 1 0 011-1h3.05l-1.64-1.64a1 1 0 111.41-1.41L11.5 8.59a1 1 0 010 1.41l-4.7 4.7a1 1 0 01-1.41-1.41L7.05 10H4a1 1 0 01-1-1z" clipRule="evenodd" />
                            </svg>
                            重新开始或录入新列表
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
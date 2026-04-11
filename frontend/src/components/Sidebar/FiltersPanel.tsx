'use client';

import { useFlightStore, ALL_CATEGORIES } from '@/store/flightStore';
import { FlightCategory } from '@/types';
import { getCategoryColor, getCategoryLabel } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Filter, RotateCcw } from 'lucide-react';
import * as Slider from '@radix-ui/react-slider';

export function FiltersPanel() {
    const { filter, setFilter } = useFlightStore();

    const toggleCategory = (cat: FlightCategory) => {
        const current = filter.categories;
        if (current.includes(cat)) {
            setFilter({ categories: current.filter((c) => c !== cat) });
        } else {
            setFilter({ categories: [...current, cat] });
        }
    };

    const resetFilters = () => {
        setFilter({
            categories: ['military'],
            minAltitude: 0,
            maxAltitude: 15000,
            minSpeed: 0,
            maxSpeed: 1000,
            showOnGround: false,
        });
    };

    const showAll = () => setFilter({ categories: [...ALL_CATEGORIES] });

    return (
        <div className="hud-panel border-r border-hud-border flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-hud-border">
                <div className="flex items-center gap-2">
                    <Filter size={12} className="text-hud-cyan" />
                    <span className="font-mono text-xs text-hud-cyan tracking-wider">DATA FILTERS</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={showAll} className="font-mono text-[9px] text-hud-text-dim hover:text-hud-cyan transition-colors" title="Show all">ALL</button>
                    <button onClick={resetFilters} className="text-hud-text-dim hover:text-hud-cyan transition-colors" title="Reset to military only">
                        <RotateCcw size={10} />
                    </button>
                </div>
            </div>

            <div className="p-3 space-y-4 overflow-y-auto">
                {/* Category toggles */}
                <div>
                    <div className="font-mono text-[10px] text-hud-text-dim mb-2 tracking-wider">FLIGHT TYPE</div>
                    <div className="grid grid-cols-2 gap-1">
                        {ALL_CATEGORIES.map((cat) => {
                            const active = filter.categories.includes(cat);
                            const color = getCategoryColor(cat);
                            return (
                                <button
                                    key={cat}
                                    onClick={() => toggleCategory(cat)}
                                    className={cn('px-2 py-1 rounded text-[10px] font-mono border transition-all', active ? 'opacity-100' : 'opacity-30 hover:opacity-60')}
                                    style={{
                                        borderColor: active ? color : '#0d2137',
                                        color: active ? color : '#4a7a99',
                                        background: active ? `${color}11` : 'transparent',
                                    }}
                                >
                                    {getCategoryLabel(cat)}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Altitude */}
                <div>
                    <div className="flex justify-between font-mono text-[10px] text-hud-text-dim mb-2">
                        <span className="tracking-wider">ALTITUDE (m)</span>
                        <span className="text-hud-text">{filter.minAltitude.toLocaleString()} – {filter.maxAltitude.toLocaleString()}</span>
                    </div>
                    <Slider.Root
                        className="relative flex items-center w-full h-5"
                        min={0} max={15000} step={500}
                        value={[filter.minAltitude, filter.maxAltitude]}
                        onValueChange={([min, max]) => setFilter({ minAltitude: min, maxAltitude: max })}
                    >
                        <Slider.Track className="relative h-[3px] grow rounded-full bg-hud-border">
                            <Slider.Range className="absolute h-full rounded-full bg-hud-cyan" />
                        </Slider.Track>
                        <Slider.Thumb className="block w-3 h-3 rounded-full bg-hud-cyan border-2 border-hud-bg focus:outline-none cursor-pointer" />
                        <Slider.Thumb className="block w-3 h-3 rounded-full bg-hud-cyan border-2 border-hud-bg focus:outline-none cursor-pointer" />
                    </Slider.Root>
                </div>

                {/* Speed */}
                <div>
                    <div className="flex justify-between font-mono text-[10px] text-hud-text-dim mb-2">
                        <span className="tracking-wider">SPEED (m/s)</span>
                        <span className="text-hud-text">{filter.minSpeed} – {filter.maxSpeed}</span>
                    </div>
                    <Slider.Root
                        className="relative flex items-center w-full h-5"
                        min={0} max={1000} step={10}
                        value={[filter.minSpeed, filter.maxSpeed]}
                        onValueChange={([min, max]) => setFilter({ minSpeed: min, maxSpeed: max })}
                    >
                        <Slider.Track className="relative h-[3px] grow rounded-full bg-hud-border">
                            <Slider.Range className="absolute h-full rounded-full bg-hud-amber" />
                        </Slider.Track>
                        <Slider.Thumb className="block w-3 h-3 rounded-full bg-hud-amber border-2 border-hud-bg focus:outline-none cursor-pointer" />
                        <Slider.Thumb className="block w-3 h-3 rounded-full bg-hud-amber border-2 border-hud-bg focus:outline-none cursor-pointer" />
                    </Slider.Root>
                </div>

                {/* On ground */}
                <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-hud-text-dim tracking-wider">SHOW ON GROUND</span>
                    <button
                        onClick={() => setFilter({ showOnGround: !filter.showOnGround })}
                        className={cn('w-8 h-4 rounded-full border transition-all relative', filter.showOnGround ? 'bg-hud-cyan/20 border-hud-cyan' : 'bg-transparent border-hud-border')}
                    >
                        <span className={cn('absolute top-0.5 w-3 h-3 rounded-full transition-all', filter.showOnGround ? 'left-4 bg-hud-cyan' : 'left-0.5 bg-hud-text-dim')} />
                    </button>
                </div>
            </div>
        </div>
    );
}

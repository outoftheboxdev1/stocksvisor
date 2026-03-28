'use client';
import { useEffect, useRef }     from "react";

const useTradingViewWidget = (scriptUrl: string, config: Record<string, unknown>, height = 600) => {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        if (container.dataset.loaded) return;

        const widget = document.createElement("div");
        widget.className = "tradingview-widget-container__widget";
        widget.style.width = "100%";
        widget.style.height = `${height}px`;

        const script = document.createElement("script");
        script.type = "text/javascript";
        script.src = scriptUrl;
        script.async = true;
        script.textContent = JSON.stringify({
            ...config,
            width: "100%",
            height: "100%",
        });

        container.replaceChildren(widget, script);
        container.dataset.loaded = 'true';

        return () => {
            if(containerRef.current) {
                containerRef.current.replaceChildren();
                delete containerRef.current.dataset.loaded;
            }
        }
    }, [scriptUrl, config, height])

    return containerRef;
}
export default useTradingViewWidget

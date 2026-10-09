import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RotateCw, Check, X, Square, Loader2 } from 'lucide-react';
import './ImageCropModal.css';

const ImageCropModal = ({ isOpen, imageSrc, category, title, onClose, onCropComplete, onSkip }) => {
    const [rotation, setRotation] = useState(0); // 0, 90, 180, 270 degrees
    const [fineAngle, setFineAngle] = useState(0); // -45 to +45 fine tilt
    const [cropRect, setCropRect] = useState({ x: 5, y: 5, width: 90, height: 90 }); // Percentages
    const [isDragging, setIsDragging] = useState(false);
    const [isImageReady, setIsImageReady] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [aspectRatio, setAspectRatio] = useState('free'); // 'free' | 'card' | 'square'

    const imageContainerRef = useRef(null);
    const displayCanvasRef = useRef(null);
    const dialCanvasRef = useRef(null);
    const loadedImgRef = useRef(null);

    // Keep cropRect ref in sync for pointer events
    const cropRectRef = useRef(cropRect);
    cropRectRef.current = cropRect;

    // Crop box drag tracking
    const dragRef = useRef({
        isDragging: false,
        pointerId: null,
        targetElement: null,
        startX: 0,
        startY: 0,
        initialRect: { x: 5, y: 5, width: 90, height: 90 },
        activeHandle: null,
        containerRect: null
    });

    // Dial protractor drag tracking
    const dialDragRef = useRef({
        isDragging: false,
        pointerId: null,
        targetElement: null,
        startX: 0,
        startAngle: 0
    });

    // Reset on modal open
    useEffect(() => {
        if (isOpen) {
            setRotation(0);
            setFineAngle(0);
            setCropRect({ x: 5, y: 5, width: 90, height: 90 });
            setIsImageReady(false);
            setIsProcessing(false);
            setAspectRatio('free');
        }
    }, [isOpen, imageSrc]);

    // Load source image
    useEffect(() => {
        if (!isOpen || !imageSrc) return;

        let isCancelled = false;
        const img = new Image();
        img.onload = () => {
            if (isCancelled) return;
            loadedImgRef.current = img;
            renderDisplayCanvas(img, rotation, fineAngle);
            setIsImageReady(true);
        };
        img.onerror = (e) => {
            console.error('Error loading image in WhatsApp cropper:', e);
        };
        img.src = imageSrc;

        return () => {
            isCancelled = true;
        };
    }, [isOpen, imageSrc, rotation, fineAngle]);

    // Re-draw display canvas on rotation/fineAngle changes
    const renderDisplayCanvas = (img, baseRotation, tilt) => {
        const canvas = displayCanvasRef.current;
        if (!canvas || !img) return;

        const isRotated90 = baseRotation === 90 || baseRotation === 270;
        const naturalW = img.naturalWidth || 1200;
        const naturalH = img.naturalHeight || 800;

        const canvasW = isRotated90 ? naturalH : naturalW;
        const canvasH = isRotated90 ? naturalW : naturalH;

        canvas.width = canvasW;
        canvas.height = canvasH;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvasW, canvasH);
        ctx.save();
        ctx.translate(canvasW / 2, canvasH / 2);
        const totalAngleRad = ((baseRotation + tilt) * Math.PI) / 180;
        ctx.rotate(totalAngleRad);
        ctx.drawImage(img, -naturalW / 2, -naturalH / 2, naturalW, naturalH);
        ctx.restore();
    };

    // Draw the curved WhatsApp angle dial / protractor
    const drawCurvedDial = useCallback((angle) => {
        const canvas = dialCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        // Center point above the canvas creating a convex downward curve
        const arcRadius = 220;
        const arcCenterX = width / 2;
        const arcCenterY = -170;

        // Draw curved guideline
        ctx.beginPath();
        ctx.arc(arcCenterX, arcCenterY, arcRadius, 0.30 * Math.PI, 0.70 * Math.PI);
        ctx.strokeStyle = 'rgba(150, 147, 147, 0.48)';
        ctx.lineWidth = 1;
        ctx.stroke();

        const centerRad = Math.PI / 2;
        const radPerDegree = Math.PI / 180;
        const dialSpreadFactor = 0.85; // Curvature spread

        for (let deg = -45; deg <= 45; deg += 1) {
            const relDeg = deg - angle;
            if (relDeg < -36 || relDeg > 36) continue; // Clip to visible window

            const markAngleRad = centerRad + (relDeg * dialSpreadFactor) * radPerDegree;
            const cos = Math.cos(markAngleRad);
            const sin = Math.sin(markAngleRad);

            const xOnArc = arcCenterX + arcRadius * cos;
            const yOnArc = arcCenterY + arcRadius * sin;

            if (deg % 10 === 0) {
                // Major number tick
                const isZero = deg === 0;
                ctx.fillStyle = '#FFFFFF';
                ctx.font = isZero ? '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' : '400 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                const textX = arcCenterX + (arcRadius - 14) * cos;
                const textY = arcCenterY + (arcRadius - 14) * sin;
                // Dark halo keeps numbers readable over any photo
                ctx.lineWidth = 3;
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
                ctx.strokeText(deg.toString(), textX, textY);
                ctx.fillText(deg.toString(), textX, textY);

                // Tick dot on the arc
                ctx.beginPath();
                ctx.arc(xOnArc, yOnArc, 2.4, 0, Math.PI * 2);
                ctx.fill();
            } else if (deg % 5 === 0) {
                // Intermediate tick
                ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                ctx.beginPath();
                ctx.arc(xOnArc, yOnArc, 1.7, 0, Math.PI * 2);
                ctx.fill();
            } else if (deg % 2 === 0) {
                // Minor tick dot
                ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
                ctx.beginPath();
                ctx.arc(xOnArc, yOnArc, 1.1, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // WhatsApp White Needle / Pointer at bottom center
        const needleTipY = arcCenterY + arcRadius + 4;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(arcCenterX, needleTipY);
        ctx.lineTo(arcCenterX - 5, needleTipY + 7);
        ctx.lineTo(arcCenterX + 5, needleTipY + 7);
        ctx.closePath();
        ctx.fill();

        // Active tilt badge: high-contrast green pill at the top center
        if (angle !== 0) {
            const label = `${angle > 0 ? '+' : ''}${angle}°`;
            ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
            const textW = ctx.measureText(label).width;
            const pillW = textW + 16;
            const pillH = 18;
            const pillX = arcCenterX - pillW / 2;
            const pillY = 2;
            ctx.fillStyle = '#25D366';
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(pillX, pillY, pillW, pillH, 9);
            } else {
                ctx.rect(pillX, pillY, pillW, pillH);
            }
            ctx.fill();
            ctx.fillStyle = '#0B141A';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, arcCenterX, pillY + pillH / 2 + 0.5);
        }
    }, []);

    // Draw dial on mount & fineAngle change
    useEffect(() => {
        drawCurvedDial(fineAngle);
    }, [fineAngle, drawCurvedDial]);

    // Dial Touch / Drag handlers
    const handleDialPointerDown = (e) => {
        e.preventDefault();
        e.stopPropagation();

        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch (err) { }

        dialDragRef.current = {
            isDragging: true,
            pointerId: e.pointerId,
            targetElement: e.currentTarget,
            startX: e.clientX,
            startAngle: fineAngle
        };
    };

    const handleDialPointerMove = (e) => {
        if (!dialDragRef.current.isDragging) return;
        e.preventDefault();
        const deltaX = e.clientX - dialDragRef.current.startX;
        const sensitivity = 0.28; // Degree per pixel moved
        let newAngle = Math.round(dialDragRef.current.startAngle - deltaX * sensitivity);
        newAngle = Math.max(-45, Math.min(45, newAngle));
        setFineAngle(newAngle);
    };

    const handleDialPointerUp = (e) => {
        if (dialDragRef.current.isDragging) {
            if (dialDragRef.current.targetElement) {
                try {
                    dialDragRef.current.targetElement.releasePointerCapture(dialDragRef.current.pointerId);
                } catch (err) { }
            }
            dialDragRef.current.isDragging = false;
        }
    };

    const handleRotate90 = () => {
        const next = (rotation + 90) % 360;
        setRotation(next);
        setCropRect({ x: 5, y: 5, width: 90, height: 90 });
    };

    const handleToggleAspect = () => {
        if (aspectRatio === 'free') {
            setAspectRatio('card');
            setCropRect({ x: 7.5, y: 15, width: 85, height: 60 });
        } else if (aspectRatio === 'card') {
            setAspectRatio('square');
            setCropRect({ x: 15, y: 15, width: 70, height: 70 });
        } else {
            setAspectRatio('free');
            setCropRect({ x: 5, y: 5, width: 90, height: 90 });
        }
    };

    // Crop box handle drag logic with PointerCapture
    const handlePointerDown = (e, handleType) => {
        e.preventDefault();
        e.stopPropagation();

        const containerRect = imageContainerRef.current?.getBoundingClientRect();
        if (!containerRect) return;

        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch (err) { }

        dragRef.current = {
            isDragging: true,
            pointerId: e.pointerId,
            targetElement: e.currentTarget,
            startX: e.clientX,
            startY: e.clientY,
            initialRect: { ...cropRectRef.current },
            activeHandle: handleType,
            containerRect
        };
        setIsDragging(true);
    };

    const handlePointerMove = (e) => {
        if (!dragRef.current.isDragging) return;
        e.preventDefault();

        const { startX, startY, initialRect, activeHandle, containerRect } = dragRef.current;
        if (!containerRect || containerRect.width === 0 || containerRect.height === 0) return;

        const deltaXPercent = ((e.clientX - startX) / containerRect.width) * 100;
        const deltaYPercent = ((e.clientY - startY) / containerRect.height) * 100;

        let { x, y, width, height } = initialRect;
        const minSize = 12;

        if (activeHandle === 'move') {
            let newX = Math.max(0, Math.min(100 - width, x + deltaXPercent));
            let newY = Math.max(0, Math.min(100 - height, y + deltaYPercent));
            setCropRect({ x: newX, y: newY, width, height });
            return;
        }

        // WhatsApp Corner Dragging:
        if (activeHandle === 'se') {
            let newW = Math.max(minSize, Math.min(100 - x, width + deltaXPercent));
            let newH = Math.max(minSize, Math.min(100 - y, height + deltaYPercent));
            setCropRect({ x, y, width: newW, height: newH });
            return;
        }

        if (activeHandle === 'sw') {
            let maxShift = width - minSize;
            let shiftX = Math.max(-x, Math.min(maxShift, deltaXPercent));
            setCropRect({
                x: x + shiftX,
                y,
                width: width - shiftX,
                height: Math.max(minSize, Math.min(100 - y, height + deltaYPercent))
            });
            return;
        }

        if (activeHandle === 'ne') {
            let maxShiftY = height - minSize;
            let shiftY = Math.max(-y, Math.min(maxShiftY, deltaYPercent));
            setCropRect({
                x,
                y: y + shiftY,
                width: Math.max(minSize, Math.min(100 - x, width + deltaXPercent)),
                height: height - shiftY
            });
            return;
        }

        if (activeHandle === 'nw') {
            let maxShiftX = width - minSize;
            let maxShiftY = height - minSize;
            let shiftX = Math.max(-x, Math.min(maxShiftX, deltaXPercent));
            let shiftY = Math.max(-y, Math.min(maxShiftY, deltaYPercent));
            setCropRect({
                x: x + shiftX,
                y: y + shiftY,
                width: width - shiftX,
                height: height - shiftY
            });
            return;
        }
    };

    const handlePointerUp = (e) => {
        if (dragRef.current.isDragging) {
            if (dragRef.current.targetElement) {
                try {
                    dragRef.current.targetElement.releasePointerCapture(dragRef.current.pointerId);
                } catch (err) { }
            }
            dragRef.current.isDragging = false;
            setIsDragging(false);
        }
    };

    // Confirm and export crop to max 1000px JPEG for token optimization
    const handleConfirm = async () => {
        if (isProcessing) return;
        setIsProcessing(true);

        try {
            const canvas = displayCanvasRef.current;
            if (!canvas || canvas.width === 0 || canvas.height === 0) {
                onCropComplete(imageSrc);
                return;
            }

            const canvasW = canvas.width;
            const canvasH = canvas.height;

            let cropPixelX = Math.round((cropRect.x / 100) * canvasW);
            let cropPixelY = Math.round((cropRect.y / 100) * canvasH);
            let cropPixelW = Math.round((cropRect.width / 100) * canvasW);
            let cropPixelH = Math.round((cropRect.height / 100) * canvasH);

            cropPixelX = Math.max(0, Math.min(canvasW - 20, cropPixelX));
            cropPixelY = Math.max(0, Math.min(canvasH - 20, cropPixelY));
            cropPixelW = Math.max(50, Math.min(canvasW - cropPixelX, cropPixelW));
            cropPixelH = Math.max(50, Math.min(canvasH - cropPixelY, cropPixelH));

            const maxDimension = 1000;
            let outW = cropPixelW;
            let outH = cropPixelH;

            if (outW > maxDimension || outH > maxDimension) {
                if (outW > outH) {
                    outH = Math.round((outH * maxDimension) / outW);
                    outW = maxDimension;
                } else {
                    outW = Math.round((outW * maxDimension) / outH);
                    outH = maxDimension;
                }
            }
            outW = Math.max(50, outW);
            outH = Math.max(50, outH);

            const outCanvas = document.createElement('canvas');
            outCanvas.width = outW;
            outCanvas.height = outH;
            const outCtx = outCanvas.getContext('2d');

            outCtx.drawImage(
                canvas,
                cropPixelX,
                cropPixelY,
                cropPixelW,
                cropPixelH,
                0,
                0,
                outW,
                outH
            );

            let croppedBase64 = outCanvas.toDataURL('image/jpeg', 0.82);

            if (!croppedBase64 || croppedBase64 === 'data:,' || croppedBase64.length < 100) {
                croppedBase64 = imageSrc;
            }

            onCropComplete(croppedBase64);
        } catch (err) {
            console.error('Error exporting WhatsApp crop:', err);
            onCropComplete(imageSrc);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen || !imageSrc) return null;

    return (
        <div
            className="wa-crop-screen"
            onClick={(e) => e.stopPropagation()}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            {/* Viewport with Canvas and WhatsApp Corner Brackets */}
            <div className="wa-crop-stage">
                <div className="wa-crop-frame" ref={imageContainerRef}>
                    <canvas ref={displayCanvasRef} className="wa-crop-canvas" />

                    {/* WhatsApp Crop Box */}
                    <div
                        className={`wa-box ${isDragging ? 'is-active' : ''}`}
                        style={{
                            left: `${cropRect.x}%`,
                            top: `${cropRect.y}%`,
                            width: `${cropRect.width}%`,
                            height: `${cropRect.height}%`,
                        }}
                        onPointerDown={(e) => handlePointerDown(e, 'move')}
                    >
                        {/* 3x3 Grid Lines */}
                        <div className="wa-grid wa-gh1" />
                        <div className="wa-grid wa-gh2" />
                        <div className="wa-grid wa-gv1" />
                        <div className="wa-grid wa-gv2" />

                        {/* WhatsApp L-shaped Corner Handles */}
                        <div
                            className="wa-bracket wa-b-nw"
                            onPointerDown={(e) => handlePointerDown(e, 'nw')}
                        />
                        <div
                            className="wa-bracket wa-b-ne"
                            onPointerDown={(e) => handlePointerDown(e, 'ne')}
                        />
                        <div
                            className="wa-bracket wa-b-se"
                            onPointerDown={(e) => handlePointerDown(e, 'se')}
                        />
                        <div
                            className="wa-bracket wa-b-sw"
                            onPointerDown={(e) => handlePointerDown(e, 'sw')}
                        />
                    </div>
                </div>

                {/* WhatsApp Curved Angle Dial / Gyroscope Protractor */}
                <div
                    className="wa-angle-dial-container"
                    onPointerDown={handleDialPointerDown}
                    onPointerMove={handleDialPointerMove}
                    onPointerUp={handleDialPointerUp}
                    onPointerCancel={handleDialPointerUp}
                    onDoubleClick={() => setFineAngle(0)}
                    title="Desliza para rotación fina (Doble clic para 0°)"
                >
                    <canvas
                        ref={dialCanvasRef}
                        width={320}
                        height={64}
                        className="wa-angle-dial-canvas"
                    />
                </div>
            </div>

            {/* WhatsApp Tool Row */}
            <div className="wa-tool-row">
                <button
                    type="button"
                    className="wa-tool-btn"
                    onClick={handleRotate90}
                    title="Rotar 90°"
                    disabled={isProcessing}
                >
                    <RotateCw size={26} strokeWidth={2.2} />
                </button>

                <button
                    type="button"
                    className={`wa-tool-btn ${aspectRatio !== 'free' ? 'is-highlighted' : ''}`}
                    onClick={handleToggleAspect}
                    title="Proporción de recorte"
                    disabled={isProcessing}
                >
                    <Square size={24} strokeWidth={2.2} />
                </button>
            </div>

            {/* WhatsApp Bottom Action Row with Cancel and Big Green Check */}
            <div className="wa-action-row">
                {/* Cancel Button: Big Dark Circle with White X */}
                <button
                    type="button"
                    className="wa-btn-circle wa-btn-cancel"
                    onClick={onClose}
                    title="Cancelar"
                    disabled={isProcessing}
                >
                    <X size={26} strokeWidth={2.5} />
                </button>

                {/* Confirm Button: Big WhatsApp Green Circle with White Check */}
                <button
                    type="button"
                    className="wa-btn-circle wa-btn-confirm"
                    onClick={handleConfirm}
                    disabled={isProcessing}
                    title="Listo / Analizar con IA"
                >
                    {isProcessing ? (
                        <Loader2 size={28} className="animate-spin" />
                    ) : (
                        <Check size={30} strokeWidth={3.2} />
                    )}
                </button>
            </div>
        </div>
    );
};

export default ImageCropModal;

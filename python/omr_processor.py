#!/usr/bin/env python3
"""
OMR (Optical Mark Recognition) Processor for Restaurant POS System
Processes scanned forms to detect marked selections and quantities
"""

import cv2
import numpy as np
import json
import sys
import os
from PIL import Image

class OMRProcessor:
    def __init__(self):
        """Initialize OMR processor with predefined form layout"""
        # Define mark positions for restaurant menu form
        # Each item has 2 marks: quantity (left) and selection (right)
        # Adaptive positions that scale with image dimensions
        self.mark_positions = [
            # Row 1: isda, egg
            {"type": "quantity", "item": "isda", "x": 0.07, "y": 0.09, "width": 0.03, "height": 0.03},
            {"type": "selection", "item": "isda", "x": 0.24, "y": 0.09, "width": 0.03, "height": 0.03},
            {"type": "quantity", "item": "egg", "x": 0.38, "y": 0.09, "width": 0.03, "height": 0.03},
            {"type": "selection", "item": "egg", "x": 0.55, "y": 0.09, "width": 0.03, "height": 0.03},
            
            # Row 2: water, sinigang
            {"type": "quantity", "item": "water", "x": 0.07, "y": 0.13, "width": 0.03, "height": 0.03},
            {"type": "selection", "item": "water", "x": 0.24, "y": 0.13, "width": 0.03, "height": 0.03},
            {"type": "quantity", "item": "sinigang", "x": 0.38, "y": 0.13, "width": 0.03, "height": 0.03},
            {"type": "selection", "item": "sinigang", "x": 0.55, "y": 0.13, "width": 0.03, "height": 0.03},
            
            # Row 3: Chicken, pusit
            {"type": "quantity", "item": "Chicken", "x": 0.07, "y": 0.17, "width": 0.03, "height": 0.03},
            {"type": "selection", "item": "Chicken", "x": 0.24, "y": 0.17, "width": 0.03, "height": 0.03},
            {"type": "quantity", "item": "pusit", "x": 0.38, "y": 0.17, "width": 0.03, "height": 0.03},
            {"type": "selection", "item": "pusit", "x": 0.55, "y": 0.17, "width": 0.03, "height": 0.03},
            
            # Row 4: gatas, beef
            {"type": "quantity", "item": "gatas", "x": 0.07, "y": 0.21, "width": 0.03, "height": 0.03},
            {"type": "selection", "item": "gatas", "x": 0.24, "y": 0.21, "width": 0.03, "height": 0.03},
            {"type": "quantity", "item": "beef", "x": 0.38, "y": 0.21, "width": 0.03, "height": 0.03},
            {"type": "selection", "item": "beef", "x": 0.55, "y": 0.21, "width": 0.03, "height": 0.03},
        ]
        
        # Threshold for considering a mark as filled (percentage of dark pixels)
        self.mark_threshold = 0.6  # 60% dark pixels = marked (very conservative to avoid false positives)
        
    def process_form(self, image_path):
        """
        Process OMR form and return detected marks
        
        Args:
            image_path (str): Path to the scanned form image
            
        Returns:
            dict: Processing results with detected marks and confidence scores
        """
        try:
            # Load image
            image = cv2.imread(image_path)
            if image is None:
                return {"success": False, "error": "Could not load image"}
            
            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Image preprocessing for better accuracy
            # Apply Gaussian blur to reduce noise
            blurred = cv2.GaussianBlur(gray, (3, 3), 0)
            
            # Apply histogram equalization to improve contrast
            equalized = cv2.equalizeHist(blurred)
            
            # Use the preprocessed image
            processed_image = equalized
            
            # Get image dimensions
            height, width = processed_image.shape
            
            # Process each mark position
            marks = []
            marked_items = []
            total_confidence = 0
            
            for pos in self.mark_positions:
                # Convert relative coordinates to absolute coordinates
                x = int(pos["x"] * width)
                y = int(pos["y"] * height)
                w = int(pos["width"] * width)
                h = int(pos["height"] * height)
                
                # Ensure coordinates are within image bounds
                x = max(0, min(x, width - w))
                y = max(0, min(y, height - h))
                w = min(w, width - x)
                h = min(h, height - y)
                
                mark_region = processed_image[y:y+h, x:x+w]
                
                if mark_region.size == 0:
                    continue
                
                # Focused mark detection - detect dark filled areas (filled circles)
                total_pixels = mark_region.size
                
                # Preprocess for better detection
                # Apply Gaussian blur to reduce noise
                blurred = cv2.GaussianBlur(mark_region, (3, 3), 0)
                
                # Use adaptive thresholding to handle varying lighting
                binary = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
                
                # Count dark pixels (marks are dark filled areas)
                dark_pixels = np.sum(binary == 0)
                white_pixels = total_pixels - dark_pixels
                
                # Calculate confidence based on dark pixel ratio
                confidence = dark_pixels / total_pixels if total_pixels > 0 else 0
                
                # For filled circles, we expect:
                # 1. Significant dark area (at least 35% of the region) - lowered from 40%
                # 2. Minimum absolute dark pixels (at least 80 pixels) - lowered from 100
                # 3. Not just noise or shadows
                min_dark_ratio = 0.35  # 35% of region should be dark
                min_dark_pixels = 80   # At least 80 dark pixels
                
                # Additional validation: check if the dark area forms a coherent shape
                # by analyzing the distribution of dark pixels
                if dark_pixels > 0:
                    # Find contours of dark areas
                    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                    
                    # Check if we have a substantial filled area
                    largest_contour_area = 0
                    if contours:
                        largest_contour_area = max(cv2.contourArea(c) for c in contours)
                    
                    # A filled circle should have a substantial single contour
                    # representing most of the dark pixels
                    contour_coverage = largest_contour_area / dark_pixels if dark_pixels > 0 else 0
                    
                    # Mark is detected if:
                    # 1. High dark pixel ratio (significant filling)
                    # 2. Sufficient absolute dark pixels
                    # 3. Either good contour coverage OR very high dark pixel ratio
                    is_marked = (
                        confidence >= min_dark_ratio and
                        dark_pixels >= min_dark_pixels and
                        (contour_coverage > 0.2 or confidence > 0.5)  # More flexible: good shape OR high fill
                    )
                else:
                    is_marked = False
                
                
                # Create mark result with filled area detection information
                mark_result = {
                    "type": pos["type"],
                    "item": pos["item"],
                    "position": {
                        "x": int(x),
                        "y": int(y),
                        "width": int(w),
                        "height": int(h)
                    },
                    "isMarked": bool(is_marked),
                    "confidence": float(confidence),
                    "whitePixels": int(white_pixels),
                    "totalPixels": int(total_pixels),
                    "darkPixels": int(dark_pixels),
                    "minDarkRatio": float(min_dark_ratio),
                    "minDarkPixels": int(min_dark_pixels),
                    "contourCoverage": float(largest_contour_area / dark_pixels) if dark_pixels > 0 else 0.0,
                    "detectionMethod": "filled_area_analysis",
                    "validationPassed": {
                        "darkRatioCheck": bool(confidence >= min_dark_ratio),
                        "darkPixelsCheck": bool(dark_pixels >= min_dark_pixels),
                        "contourCoverageCheck": bool((largest_contour_area / dark_pixels) > 0.2 or confidence > 0.5) if dark_pixels > 0 else False
                    }
                }
                
                marks.append(mark_result)
                total_confidence += confidence
                
                # Track marked items for selection type marks
                if is_marked and pos["type"] == "selection":
                    marked_items.append(pos["item"])
            
            # Calculate overall confidence
            overall_confidence = total_confidence / len(marks) if marks else 0
            
            return {
                "success": True,
                "marks": marks,
                "confidence": overall_confidence,
                "image_dimensions": {
                    "width": width,
                    "height": height
                },
                "total_marks_detected": len(marks),
                "marked_items": marked_items
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}

def main():
    """Main function for command line usage"""
    if len(sys.argv) != 2:
        print("Usage: python omr_processor.py <image_path>", flush=True)
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    if not os.path.exists(image_path):
        print(f"Error: Image file not found: {image_path}", flush=True)
        sys.exit(1)
    
    processor = OMRProcessor()
    result = processor.process_form(image_path)
    
    # Output only JSON result (no debug messages)
    print(json.dumps(result, indent=2), flush=True)

if __name__ == "__main__":
    main()

// src/components/UI/NewStyledButton.js
import React from 'react';

// Spinner component to be used inside the button
const Spinner = () => (
    <span className="spinner" aria-hidden="true"></span>
);

/**
 * A styled button component with support for different variants, icons, and loading states.
 * @param {string} id - The ID for the button or label.
 * @param {function} onClick - Function to call when the button is clicked.
 * @param {string} label - The text label for the button.
 * @param {string} variant - Button style variant ('primary', 'secondary', 'tertiary', 'file-input'). Defaults to 'primary'.
 * @param {boolean} disabled - Whether the button is disabled. Defaults to false.
 * @param {boolean} isLoading - Whether the button is in a loading state. Defaults to false.
 * @param {string} loadingText - Text to display when isLoading is true. Defaults to "Ładowanie...".
 * @param {string} iconSvgPath - The 'd' attribute for an SVG path if using a simple path icon.
 * @param {string} iconViewBox - The viewBox for the SVG icon. Defaults to "0 0 24 24".
 * @param {React.ReactNode} children - Allows passing custom icon components or other elements. Takes precedence over iconSvgPath.
 * @param {string} className - Additional CSS classes for the button.
 * @param {boolean} isFileInputLabel - If true, renders as a <label> styled as a button. Defaults to false.
 * @param {string} htmlFor - The 'for' attribute if rendering as a label.
 * @param {string} type - The button type attribute (e.g., "button", "submit"). Defaults to "button".
 */
const NewStyledButton = ({
    id,
    onClick,
    label,
    variant = 'primary',
    disabled = false,
    isLoading = false,
    loadingText = "Ładowanie...",
    iconSvgPath,
    iconViewBox = "0 0 24 24",
    children,
    className = '',
    isFileInputLabel = false,
    htmlFor,
    type = "button"
}) => {
    // Base class for all buttons
    const baseClasses = "btn";
    let variantClasses = "";

    // Determine variant-specific classes
    switch (variant) {
        case 'primary':
            // Primary buttons have a specific disabled style that includes background change
            variantClasses = isLoading || disabled ? 'btn-primary-disabled' : 'btn-primary';
            break;
        case 'secondary':
            variantClasses = 'btn-secondary';
            break;
        case 'tertiary':
            variantClasses = 'btn-tertiary';
            break;
        case 'file-input': // Special variant for file input label styled as a primary button
            variantClasses = isLoading || disabled ? 'btn-primary-disabled file-input-label' : 'btn-primary file-input-label';
            break;
        default:
            variantClasses = 'btn-primary';
    }

    // Construct the button's inner content
    const buttonContent = (
        <>
            {isLoading && <Spinner />}
            {/* If custom children (e.g., complex SVG icon) are provided, render them */}
            {!isLoading && children}
            {/* If no custom children and an iconSvgPath is provided, render the path-based SVG icon */}
            {!isLoading && !children && iconSvgPath && (
                <svg className="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox={iconViewBox} strokeWidth="2" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d={iconSvgPath} />
                </svg>
            )}
            {/* Text label for the button */}
            <span className="button-text-label">
                {isLoading ? loadingText : label}
            </span>
        </>
    );

    // Render as a <label> if isFileInputLabel is true
    if (isFileInputLabel) {
        return (
            <label
                htmlFor={htmlFor}
                id={id}
                className={`${baseClasses} ${variantClasses} ${disabled && !(isLoading || variant === 'primary' || variant === 'file-input') ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
                // The onClick for a label needs to be handled carefully, often the input itself handles the click.
                // However, for styling and potentially triggering other actions, it can be useful.
                onClick={!disabled && !isLoading ? onClick : undefined}
                // Make it behave like a button for accessibility if it's not inherently interactive (though labels are)
                role="button"
                tabIndex={disabled ? -1 : 0}
                onKeyDown={(e) => {
                    if (!disabled && !isLoading && (e.key === 'Enter' || e.key === ' ')) {
                        onClick?.();
                    }
                }}

            >
                {buttonContent}
            </label>
        );
    }

    // Render as a <button> by default
    return (
        <button
            id={id}
            type={type}
            onClick={onClick}
            disabled={disabled || isLoading}
            className={`${baseClasses} ${variantClasses} ${className}`}
        >
            {buttonContent}
        </button>
    );
};

export default NewStyledButton;
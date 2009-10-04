/**
 * Provides the Accordion class
 *
 * @module accordion
 */

(function(){

/**
 * Create an AccordionItem widget.
 * 
 * @param config {Object} Object literal specifying AccordionItem configuration properties.
 *
 * @class AccordionItem
 * @constructor
 * @extends Widget
 */

function AccordionItem( config ){
    AccordionItem.superclass.constructor.apply( this, arguments );
}

// Local constants
var Lang = Y.Lang,
    Base = Y.Base,
    Node = Y.Node,
    WidgetStdMod = Y.WidgetStdMod,
    AccItemName = "accordion-item",
    getCN = Y.ClassNameManager.getClassName;

/**
 *  Static property provides a string to identify the class.
 *
 * @property AccordionItem.NAME
 * @type String
 * @static
 */
AccordionItem.NAME = AccItemName;

/**
 * Static property used to define the default attribute 
 * configuration for the Accordion.
 * 
 * @property Accordion.ATTRS
 * @type Object
 * @static
 */
AccordionItem.ATTRS = {
    /**
     * @description The icon of the item. The value can be one of these:
     *  <dl>
     *      <dt>default</dt>
     *          <dd>The AccordionItem will use the default icon</dd>
     *      <dt>Custom class name</dt>
     *          <dd>A custom class to be added to icon's classes</dd>
     *  </dl>
     *
     * @attribute icon
     * @default "default"
     * @type String
     */
    icon: {
        value: "default",
        validator: Lang.isString
    },

    /**
     * @description The label of the item
     *
     * @attribute label
     * @default "&#160;"
     * @type String
     */
    label: {
        value: "&#160;",
        validator: Lang.isString
    },
    
    /**
     * @description Icon always visible
     *
     * @attribute iconAlwaysVisible
     * @default null
     * @readOnly
     * @type Node
     */
    iconAlwaysVisible: {
        value: null,
        validator: function( value ){
            return value instanceof Node;
        },
        getter: function(){
            return this._iconAlwaysVisible;
        },
        readOnly: true
    },
    
    /**
     * @description Icon extended
     *
     * @attribute iconExtended
     * @default null
     * @readOnly
     * @type Node
     */
    iconExtended: {
        value: null,
        validator: function( value ){
            return value instanceof Node;
        },
        getter: function(){
            return this._iconExtended;
        },
        readOnly: true
    },


    /**
     * @description Icon close, or null if the item is not closable
     *
     * @attribute iconClose
     * @default null
     * @readOnly
     * @type Node
     */
    iconClose: {
        value: null,
        validator: function( value ){
            return value instanceof Node;
        },
        getter: function(){
            return this._iconClose;
        }
    },

    /**
     * @description Get/Set the expanded status of the item
     *
     * @attribute expanded
     * @default false
     * @type Boolean
     */
    expanded: {
        value: false,
        validator: Lang.isBoolean
    },

    /**
     * @description Describe the method, which will be used when expanding/collapsing
     * the item. The value should be an object with at least one property ("method"):
     *  <dl>
     *      <dt>method</dt>
     *          <dd>The method can be one of these: "auto", "fixed" and "stretch"</dd>
     *      <dt>height</dt>
     *          <dd>Must be set only if method's value is "fixed"</dd>
     *  </dl>
     *
     * @attribute contentHeight
     * @default auto
     * @type Object
     */
    contentHeight: {
        value: {
            method: "auto"
        },
        validator: function( value ){
            if( Lang.isObject( value ) ){
                if( value.method === "auto" ){
                    return true;
                } else if( value.method === "stretch" ){
                    return true;
                } else if( value.method === "fixed" && Lang.isNumber( value.height ) && 
                    value.height >= 0 ){
                    return true;
                }
            }
            
            return false;
        }
    },

    /**
     * @description Get/Set the expanded status of the item
     *
     * @attribute alwaysVisible
     * @default false
     * @type Boolean
     */
    alwaysVisible: {
        value: false,
        validator: Lang.isBoolean
    },
    
    
    /**
     * @description Get/Set the animaton specific settings. By default there are no any settings.
     * If set, they will overwrite Accordion's animation settings
     *
     * @attribute animation
     * @default {}
     * @type Object
     */
    animation: {
        value: {},
        validator: Lang.isObject
    },

    /**
     * @description Provides client side string localization support.
     *
     * @attribute strings
     * @default Object English messages
     * @type Object
     */
    strings: {
        value: {
            title_always_visible_off: "Click to set always visible on",
            title_always_visible_on: "Click to set always visible off",
            title_iconextended_off: "Click to expand",
            title_iconextended_on: "Click to collapse",
            title_iconclose: "Click to close"
        }
    },

    /**
     * @description Flag, indicated whether the item can be closed by user, or not
     * If yes, there will be placed close icon, otherwise not
     *
     * @attribute closable
     * @default false
     * @type Boolean
     */
    closable: {
        value: false,
        validator: Lang.isBoolean
    }
};


// AccordionItem classes
AccordionItem.C_ITEM                         = getCN( AccItemName );
AccordionItem.DEFAULT_ICON                   = "default";

AccordionItem.C_TABLE                        = getCN( AccItemName, "table" );
AccordionItem.C_TD_ICON                      = getCN( AccItemName, "td", "icon" );
AccordionItem.C_TD_LABEL                     = getCN( AccItemName, "td", "label" );

AccordionItem.C_TD_ICONALWAYSVISIBLE         = getCN( AccItemName, "td", "iconalwaysvisible" );
AccordionItem.C_TD_ICONEXTENDED              = getCN( AccItemName, "td", "iconextended" );
AccordionItem.C_TD_ICONCLOSE                 = getCN( AccItemName, "td", "iconclose" );
AccordionItem.C_TD_ICONCLOSE_HIDDEN          = getCN( AccItemName, "td", "iconclose", "hidden" );

AccordionItem.C_ICONEXTENDED_EXPANDING       = getCN( AccItemName, "iconextended", "expanding" );
AccordionItem.C_ICONEXTENDED_COLLAPSING      = getCN( AccItemName, "iconextended", "collapsing" );

AccordionItem.C_ICON                         = getCN( AccItemName, "icon" );
AccordionItem.C_LABEL                        = getCN( AccItemName, "label" );
AccordionItem.C_ICONALWAYSVISIBLE            = getCN( AccItemName, "iconalwaysvisible" );
AccordionItem.C_ICONEXTENDED                 = getCN( AccItemName, "iconextended" );
AccordionItem.C_ICONCLOSE                    = getCN( AccItemName, "iconclose" );

AccordionItem.C_EXPANDED                     =  getCN( AccItemName, "expanded" );
AccordionItem.C_CLOSABLE                     =  getCN( AccItemName, "closable" );
AccordionItem.C_ALWAYSVISIBLE                =  getCN( AccItemName, "alwaysvisible" );
AccordionItem.C_CONTENTHEIGHT                =  getCN( AccItemName, "contentheight" );

AccordionItem.C_ICONEXTENDED_ON              = getCN( AccItemName, "iconextended", "on" );
AccordionItem.C_ICONEXTENDED_OFF             = getCN( AccItemName, "iconextended", "off" );

AccordionItem.C_ICONALWAYSVISIBLE_ON         = getCN( AccItemName, "iconalwaysvisible", "on" );
AccordionItem.C_ICONALWAYSVISIBLE_OFF        = getCN( AccItemName, "iconalwaysvisible", "off" );


/**
 * Static Object hash used to capture existing markup for progressive
 * enhancement.  Keys correspond to config attribute names and values
 * are selectors used to inspect the contentBox for an existing node
 * structure.
 *
 * @property AccordionItem.HTML_PARSER
 * @type Object
 * @protected
 * @static
 */
AccordionItem.HTML_PARSER = {

    label: function ( contentBox ){
        var node, labelClass;
        
        labelClass = "> .yui-widget-hd > div." + AccordionItem.C_LABEL;
        node = contentBox.query( labelClass );

        return (node) ? node.get( "innerHTML" ) : null;
    },

    icon: function ( contentBox ){
        var node, iconClass;
        
        iconClass = "> .yui-widget-hd > div." + AccordionItem.C_ICON;
        node = contentBox.query( iconClass );

        if( node ){
            iconClass = node.get( "className" );

            if( iconClass && Lang.isString( iconClass ) ){
                return iconClass;
            }
        }

        return null;
    },

    iconClose: function( contentBox ){
        var node, iconCloseClass;

        iconCloseClass = "> .yui-widget-hd > div." + AccordionItem.C_ICONCLOSE;
        node = contentBox.query( iconCloseClass );

        if( node ){
            iconCloseClass = node.get( "className" );

            if( iconCloseClass && Lang.isString( iconCloseClass ) ){
                return iconCloseClass;
            }
        }

        return null;
    },

    expanded: function( contentBox ){
        var expanded;

        expanded = contentBox.hasClass( AccordionItem.C_EXPANDED );

        return expanded;
    },

    alwaysVisible: function( contentBox ){
        var alwaysVisible;

        alwaysVisible = contentBox.hasClass( AccordionItem.C_ALWAYSVISIBLE );

        return alwaysVisible;
    },

    closable: function( contentBox ){
        var closable;

        closable = contentBox.hasClass( AccordionItem.C_CLOSABLE );

        return closable;
    },

    contentHeight: function( contentBox ){
        var contentHeightClass, classValue, height = 0, i, length, index, chr;

        classValue = contentBox.get( "className" );

        contentHeightClass = AccordionItem.C_CONTENTHEIGHT + '-';

        index = classValue.indexOf( contentHeightClass, 0);

        if( index >= 0 ){
            length = classValue.length;
            index += contentHeightClass.length;

            classValue = classValue.substring( index );

            if( classValue.match( /^auto\s*/g ) ){
                return {
                    method: "auto"
                };
            } else if( classValue.match( /^stretch\s*/g ) ){
                return {
                    method: "stretch"
                };
            } else if( classValue.match( /^fixed-\d+/g )  ){
                for( i = 6, length = classValue.length; i < length; i++ ){ // 6 = "fixed-".length
                    chr = classValue.charAt(i);
                    chr = parseInt( chr, 10 );

                    if( Lang.isNumber( chr ) ){
                        height = (height * 10) + chr;
                    } else {
                        break;
                    }
                }

                return {
                    method: "fixed",
                    height: height
                };
            }
        }

        return null;
    }
};


// AccordionItem extends Widget

Y.extend( AccordionItem, Y.Widget, {

    /**
     * Creates the header content of an AccordionItem
     *
     * @method _createHeader
     * @protected
     */
    _createHeader: function(){
        var strings, html, node, closable;

        function setIcon(){
            var icon = this.get( "icon" );

            if( icon === AccordionItem.DEFAULT_ICON ){
                return AccordionItem.C_ICON;
            } else {
                return icon;
            }
        }

        strings = this.get( "strings" );
        closable = this.get( "closable" );

        html = [
            "<TABLE selectable='no' class='", AccordionItem.C_TABLE, "'>",
            "<TBODY>",
            "<TR>",
                "<TD class='", AccordionItem.C_TD_ICON, "'", " id='", Y.guid(), "'>",
                    "<div id='", Y.guid(), "' class='", setIcon.call(this), "' align='middle' ", "/>",
                "</TD>",
                "<TD class='" , AccordionItem.C_TD_LABEL, "'>" ,
                    "<div class='" , AccordionItem.C_LABEL, "'" ,
                       " id='", Y.guid(), "' ", ">",
                       "<a href='#'>", this.get( "label" ), "</a>",
                    "</div>",
                "</TD>",
                "<TD class='", AccordionItem.C_TD_ICONALWAYSVISIBLE, "'", ">" ,
                    "<div tabindex='0' class='",
                        AccordionItem.C_ICONALWAYSVISIBLE, " " , AccordionItem.C_ICONALWAYSVISIBLE_OFF , "'",
                        " title='", strings.title_always_visible_off, "'",
                        " id='", Y.guid(), "'>",
                    "</div>",                    
                "</TD>",
                "<TD class='" , AccordionItem.C_TD_ICONEXTENDED, "'>" ,
                    "<div tabindex='0' class='" , AccordionItem.C_ICONEXTENDED, " ", AccordionItem.C_ICONEXTENDED_OFF, "'",
                        " title='", strings.title_iconextended_off, "'",
                        " id='", Y.guid(), "'>",
                    "</div>",
                "</TD>",
                "<TD class='" , AccordionItem.C_TD_ICONCLOSE, " ", (!closable ? AccordionItem.C_TD_ICONCLOSE_HIDDEN : ""), "'>" ,
                    "<div tabindex='0' class='" , AccordionItem.C_ICONCLOSE, "'",
                        " title='", strings.title_iconclose, "'",
                        " id='", Y.guid(), "'>",
                    "</div>",
                "</TD>",
            "</TR>",
            "</TBODY>",
            "</TABLE>"
        ].join( '' );

        node = Node.create( html );
        this.set( "headerContent", node );
    },


    /**
     * Handles the change of "iconChanged" property. Set custom or default class for the icon
     * 
     * @method _iconChanged
     * @protected
     * @param {EventFacade} params The event facade for the attribute change
     */
    _iconChanged: function( params ){
        var icon;

        icon = params.newVal;

        if( this.get( "rendered" ) ){
            if( icon === AccordionItem.DEFAULT_ICON ){
                this._icon.set( "className", AccordionItem.C_ICON );
            } else {
                this._icon.addClass( icon );
            }
        }
    },

    
    /**
     * Handles the change of "labelChanged" property. Updates item's UI with the label provided
     * 
     * @method _labelChanged
     * @protected
     * @param {EventFacade} params The event facade for the attribute change
     */
    _labelChanged: function( params ){
        if( this.get( "rendered" ) ){
            this._label.set( "innerHTML", ["<a href='#'>", params.newVal, "</a>" ].join('') );
        }
    },


    /**
     * Handles the change of "closableChanged" property. Hides or shows close icon
     *
     * @method _closableChanged
     * @protected
     * @param {EventFacade} params The event facade for the attribute change
     */
    _closableChanged: function( params ){
        var selector, node, contentBox;

        if( this.get( "rendered" ) ){
            contentBox = this.get( 'contentBox' );
        
            selector = "> .yui-widget-hd ." + AccordionItem.C_TD_ICONCLOSE;
            node = contentBox.query( selector );

            if( params.newVal ){
                node.removeClass( AccordionItem.C_TD_ICONCLOSE_HIDDEN );
            } else {
                node.addClass( AccordionItem.C_TD_ICONCLOSE_HIDDEN );
            }
        }
    },


    /**
     * Initializer lifecycle implementation for the AccordionItem class.
     *
     * @method initializer
     * @protected
     * @param  config {Object} Configuration object literal for the AccordionItem
     */
    initializer: function( config ) {
        this.after( 'render', Y.bind( this._afterRender, this ) );
        this.after( "iconChange", Y.bind( this._iconChanged, this ) );
        this.after( "labelChange",  Y.bind( this._labelChanged, this ) );
        this.after( "closableChange", Y.bind( this._closableChanged, this ) );
    },


    /**
     * Get references to elements, which compose the header
     *
     * @method _afterRender
     * @protected
     * @param e {Event} after render custom event
     */
    _afterRender: function( e ){
        var contentBox = this.get( 'contentBox' );

        this._icon = contentBox.query( "." + AccordionItem.C_ICON );
        this._label = contentBox.query( "." + AccordionItem.C_LABEL );
        this._iconAlwaysVisible = contentBox.query( "." + AccordionItem.C_ICONALWAYSVISIBLE );
        this._iconExtended = contentBox.query( "." + AccordionItem.C_ICONEXTENDED );
        this._iconClose = contentBox.query( "." + AccordionItem.C_ICONCLOSE );
    },
    
    
    /**
     * Destructor lifecycle implementation for the AccordionItem class.
     *
     * @method destructor
     * @protected
     */
    destructor : function() {
        // EMPTY
    },

    
    /**
     * Creates AccordionItem's header.
     * 
     * @method renderUI
     * @protected
     */
    renderUI: function(){
        this._createHeader();
    },
    
    /**
     * Configures/Sets up listeners to bind Widget State to UI/DOM
     *
     * @method bindUI
     * @protected
     */
    bindUI: function(){
        var selector, contentBox;
        
        contentBox = this.get( 'contentBox' );
        selector = [ 'div.', AccordionItem.C_LABEL, ' a' ].join('');

        contentBox.delegate( "click", Y.bind( this._onLinkClick, this ), selector );
    },



    /**
     * Prevent default action on clicking the link in the label
     *
     * @method _onLinkClick
     * @protected
     *
     * @param e {Event} The click event
     */
    _onLinkClick: function( e ){
        e.preventDefault();
    },
    
   /**
    * Marks the item as always visible by adding class to always visible icon.
    * The icon will be updated only if needed.
    * 
    * @method markAsAlwaysVisible
    * @param {Boolean} alwaysVisible Whether or not the item should be marked as always visible
    * @return Boolean Return true if the icon has been updated, false if there was no need to update
    */
    markAsAlwaysVisible: function( alwaysVisible ){
        var strings = this.get( "strings" );

        if( alwaysVisible ){
            if( !this._iconAlwaysVisible.hasClass( AccordionItem.C_ICONALWAYSVISIBLE_ON ) ){
                this._iconAlwaysVisible.replaceClass( AccordionItem.C_ICONALWAYSVISIBLE_OFF, AccordionItem.C_ICONALWAYSVISIBLE_ON );
                this._iconAlwaysVisible.set( "title", strings.title_always_visible_on );
                return true;
            }
        } else {
            if( this._iconAlwaysVisible.hasClass( AccordionItem.C_ICONALWAYSVISIBLE_ON ) ){
                this._iconAlwaysVisible.replaceClass( AccordionItem.C_ICONALWAYSVISIBLE_ON, AccordionItem.C_ICONALWAYSVISIBLE_OFF );
                this._iconAlwaysVisible.set( "title", strings.title_always_visible_off );
                return true;
            }
        }
        
        return false;
    },

    
    /**
    * Marks the item as expanded by adding class to expand icon.
    * The icon will be updated only if needed.
    * 
    * @method markAsExpanded
    * @param {Boolean} expanded Whether or not the item should be marked as expanded
    * @return Boolean Return true if the icon has been updated, false if there was no need to update
    */
    markAsExpanded: function( expanded ){
        var strings = this.get( "strings" );

        if( expanded ){
            if( !this._iconExtended.hasClass( AccordionItem.C_ICONEXTENDED_ON ) ){
                this._iconExtended.replaceClass( AccordionItem.C_ICONEXTENDED_OFF, AccordionItem.C_ICONEXTENDED_ON );
                this._iconExtended.set( "title" , strings.title_iconextended_on );
                return true;
            }
        } else {
            if( this._iconExtended.hasClass( AccordionItem.C_ICONEXTENDED_ON ) ){
                this._iconExtended.replaceClass( AccordionItem.C_ICONEXTENDED_ON, AccordionItem.C_ICONEXTENDED_OFF );
                this._iconExtended.set( "title" , strings.title_iconextended_off );
                return true;
            }
        }
        
        return false;
    },

   
   /**
    * Marks the item as expanding by adding class to expand icon.
    * The method will update icon only if needed.
    * 
    * @method markAsExpanding
    * @param {Boolean} expanding Whether or not the item should be marked as expanding
    * @return Boolean Return true if the icon has been updated, false if there was no need to update
    */
    markAsExpanding: function( expanding ){
        if( expanding ){
            if( !this._iconExtended.hasClass( AccordionItem.C_ICONEXTENDED_EXPANDING ) ){
                this._iconExtended.addClass( AccordionItem.C_ICONEXTENDED_EXPANDING );
                return true;
            }
        } else {
            if( this._iconExtended.hasClass( AccordionItem.C_ICONEXTENDED_EXPANDING ) ){
                this._iconExtended.removeClass( AccordionItem.C_ICONEXTENDED_EXPANDING );
                return true;
            }
        }
        
        return false;
    },

    
   /**
    * Marks the item as collapsing by adding class to expand icon.
    * The method will update icon only if needed.
    * 
    * @method markAsCollapsing
    * @param {Boolean} collapsing Whether or not the item should be marked as collapsing
    * @return Boolean Return true if the icon has been updated, false if there was no need to update
    */
    markAsCollapsing: function( collapsing ){
        if( collapsing ){
            if( !this._iconExtended.hasClass( AccordionItem.C_ICONEXTENDED_COLLAPSING ) ){
                this._iconExtended.addClass( AccordionItem.C_ICONEXTENDED_COLLAPSING );
                return true;
            }
        } else {
            if( this._iconExtended.hasClass( AccordionItem.C_ICONEXTENDED_COLLAPSING ) ){
                this._iconExtended.removeClass( AccordionItem.C_ICONEXTENDED_COLLAPSING );
                return true;
            }
        }
        
        return false;
    }
    
});

// Add WidgetStdMod's functionality to AccordionItem
Base.build( AccordionItem.NAME, AccordionItem, [ WidgetStdMod ], {
    dynamic: false
});

Y.AccordionItem = AccordionItem;

}());


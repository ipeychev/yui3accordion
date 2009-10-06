YUI.add('accordion', function(Y) {

/**
 * Provides the Accordion class
 *
 * @module accordion
 */

(function(){

/**
 * Accordion creates an widget, consists of one or more items, which can be collapsed, expanded,
 * set as always visible and reordered by using Drag&Drop. Collapsing/expanding might be animated.
 * 
 * @param config {Object} Object literal specifying Accordion configuration properties.
 *
 * @class Accordion
 * @constructor
 * @extends Widget
 */

function Accordion( config ){
    Accordion.superclass.constructor.apply( this, arguments );
}

// Local constants
var Lang = Y.Lang,
    Node = Y.Node,
    Anim = Y.Anim,
    Easing = Y.Easing,
    AccName = "accordion",
    WidgetStdMod = Y.WidgetStdMod,
    QuirksMode = document.compatMode == "BackCompat",
    IEQuirksMode = QuirksMode && Y.UA.ie > 0,
    COLLAPSE_HEIGHT = IEQuirksMode ? 1 : 0,
    getCN = Y.ClassNameManager.getClassName,
    
    C_ITEM = "yui-accordion-item",
    C_PROXY_VISIBLE = getCN( AccName, "proxyel", "visible" ),
    DRAGGROUP = getCN( AccName, "graggroup" ),

    BEFOREITEMADD = "beforeItemAdd",
    ITEMADDED = "itemAdded",
    BEFOREITEMREMOVE = "beforeItemRemove",
    ITEMREMOVED = "itemRemoved",
    BEFOREITEMERESIZED = "beforeItemResized",
    ITEMERESIZED = "itemResized",

    BEFOREITEMEXPAND  = "beforeItemExpand",
    BEFOREITEMCOLLAPSE = "beforeItemCollapse",
    ITEMEXPANDED = "itemExpanded",
    ITEMCOLLAPSED = "itemCollapsed",

    BEFOREITEMREORDER = "beforeItemReorder",
    BEFOREENDITEMREORDER = "beforeEndItemReorder",
    ITEMREORDERED = "itemReordered",
    
    DEFAULT = "default",
    ANIMATION = "animation",
    ALWAYSVISIBLE = "alwaysVisible",
    EXPANDED = "expanded",
    COLLAPSEOTHERSONEXPAND = "collapseOthersOnExpand",
    ITEMS = "items",
    CONTENT_HEIGHT = "contentHeight",
    ICON_CLOSE = "iconClose",
    ICON_ALWAYSVISIBLE = "iconAlwaysVisible",
    STRETCH = "stretch",
    PX = "px",
    CONTENT_BOX = "contentBox",
    BOUNDING_BOX = "boundingBox",
    RENDERED = "rendered",
    BODYCONTENT = "bodyContent",
    CHILDREN = "children",
    PARENT_NODE = "parentNode",
    NODE = "node",
    DATA = "data";


/**
 *  Static property provides a string to identify the class.
 *
 * @property Accordion.NAME
 * @type String
 * @static
 */
Accordion.NAME = AccName;

/**
 * Static property used to define the default attribute 
 * configuration for the Accordion.
 * 
 * @property Accordion.ATTRS
 * @type Object
 * @static
 */
Accordion.ATTRS = {
    /**
     * @description The event on which Accordion should listen for user interactions.
     * The value can be also mousedown or mouseup. Mousedown event can be used if
     * drag&drop is not enabled
     *
     * @attribute itemChosen
     * @default click
     * @type String
     */
    itemChosen: {
        value: "click",
        validator: Lang.isString
    },

    /**
     * @description Contains the items, currently added to Accordion
     * 
     * @attribute items
     * @readOnly
     * @default []
     * @type Array
     */
    items: {
        value: [],
        readOnly: true,
        validator: Lang.isArray
    },
    
    /**
     * @attribute resizeEvent
     * 
     * @description The event on which Accordion should listen for resizing.
     * The value must be one of these:
     * <ul>
     *     <li> String "default" - the Accordion will subscribe to Y.windowresize event
     *     </li>
     *     <li> An object in the following form: 
     *         {
     *             sourceObject: some_javascript_object,
     *             resizeEvent: an_event_to_subscribe
     *         }
     *      </li>
     * </ul>
     * For example, if we are using LayoutManager's instance as sourceObject, we will have to use its "resize" event as resizeEvent
     *  
     * @default "default"
     * @type String or Object, see the description above
     */

    resizeEvent: {
        value: DEFAULT,
        validator: function( value ){
            return (Lang.isString(value) || Lang.isObject(value));
        }
    },

    /**
     * @attribute useAnimation
     * @description Whether or not Accordion should use animation when expand or collapse some item
     * The animation in Accordion is slow in IE6
     * 
     * @default: true
     * @type boolean
     */
    useAnimation: {
        value: true,
        validator: Lang.isBoolean
    },

    /**
     * @attribute animation
     * @description Animation config values, see Y.Animation
     * 
     * @default <code> {
     *    duration: 1, 
     *    easing: Easing.easeOutStrong
     *  }
     *  </code>
     *  
     * @type Object
     */
    animation: {
        value: {
            duration: 1,
            easing: Easing.easeOutStrong
        },
        validator: function( value ){
            return Lang.isObject( value ) && Lang.isNumber( value.duration ) &&
                Lang.isFunction( value.easing );
        }
    },

    /**
     * @attribute reorderItems
     * @description Whether or not the items in Accordion can be reordered by using drag&drop
     * 
     * @default true
     * @type boolean
     */
    reorderItems: {
        value: true,
        validator: Lang.isBoolean
    },

    /**
     * @attribute collapseOthersOnExpand
     * @description If true, on item expanding, all other expanded and not set as always visible items, will be collapsed
     * Otherwise, they will stay open
     * 
     * @default true
     * @type Boolean
     */
    collapseOthersOnExpand: {
        value: true,
        validator: Lang.isBoolean
    }
};

// Accordion extends Widget

Y.extend( Accordion, Y.Widget, {

    /**
     * Initializer lifecycle implementation for the Accordion class. Publishes events,
     * initializes internal properties and subscribes for resize event.
     *
     * @method initializer
     * @protected
     * @param  config {Object} Configuration object literal for the Accordion
     */
    initializer: function( config ) {
        this._initEvents();

        this._lastChild = null;

        this.after( "render", Y.bind( this._afterRender, this ) );

        this._forCollapsing = {};
        this._forExpanding = {};
        this._animations   = {};
    },

    
    /**
     * Destructor lifecycle implementation for the Accordion class.
     * Removes and destroys all registered items.
     *
     * @method destructor
     * @protected
     */
    destructor: function() {
        var items, item, i, length;
        
        items = this.get( ITEMS );
        length = items.length;
        
        for( i = length - 1; i >= 0; i-- ){
            item = items[ i ];
            
            items.splice( i, 1 );
            
            this._removeItemHandles( item );
            
            item.destroy();
        }
    },

    
    /**
     * Publishes Accordion's events
     *
     * @method _initEvents
     * @protected
     */
    _initEvents: function(){
        
        /**
         * Signals the beginning of adding an item to the Accordion.
         *
         * @event beforeItemAdd
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item being added</dd>
         *  </dl>
         */
        this.publish( BEFOREITEMADD );
        
        /**
         * Signals an item has been added to the Accordion.
         *
         * @event itemAdded
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item that has been added</dd>
         *  </dl>
         */
        this.publish( ITEMADDED );
        
        /**
         * Signals the beginning of removing an item.
         *
         * @event beforeItemRemove
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item being removed</dd>
         *  </dl>
         */
        this.publish( BEFOREITEMREMOVE );
        
        /**
         * Signals an item has been removed from Accordion.
         *
         * @event itemRemoved
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item that has been removed</dd>
         *  </dl>
         */
        this.publish( ITEMREMOVED );

        /**
         * Signals the beginning of resizing an item.
         *
         * @event beforeItemResized
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item being resized</dd>
         *  </dl>
         */
        this.publish( BEFOREITEMERESIZED );
        
        /**
         * Signals an item has been resized.
         *
         * @event itemResized
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item that has been resized</dd>
         *  </dl>
         */
        this.publish( ITEMERESIZED );

        /**
         * Signals the beginning of expanding an item
         *
         * @event beforeItemExpand
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item being expanded</dd>
         *  </dl>
         */
        this.publish( BEFOREITEMEXPAND );
        
        /**
         * Signals the beginning of collapsing an item
         *
         * @event beforeItemCollapse
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item being collapsed</dd>
         *  </dl>
         */
        this.publish( BEFOREITEMCOLLAPSE );
        
        
        /**
         * Signals an item has been expanded
         *
         * @event itemExpanded
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item that has been expanded</dd>
         *  </dl>
         */
        this.publish( ITEMEXPANDED );
        
        /**
         * Signals an item has been collapsed
         *
         * @event itemCollapsed
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item that has been collapsed</dd>
         *  </dl>
         */
        this.publish( ITEMCOLLAPSED );
        
        /**
         * Signals the beginning of reordering an item
         *
         * @event beforeItemReorder
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item being reordered</dd>
         *  </dl>
         */
        this.publish( BEFOREITEMREORDER );
        
        /**
         * Fires before the end of item reordering
         *
         * @event beforeEndItemReorder
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item being reordered</dd>
         *  </dl>
         */
        this.publish( BEFOREENDITEMREORDER );
        
        
        /**
         * Signals an item has been reordered
         *
         * @event itemReordered
         * @param event {Event.Facade} An Event Facade object with the following attribute specific properties added:
         *  <dl>
         *      <dt>item</dt>
         *          <dd>An <code>AccordionItem</code> instance of the item that has been reordered</dd>
         *  </dl>
         */
        this.publish( ITEMREORDERED );
    },

    
    /**
     * Collection of items handles.
     * Keeps track of each items's event handle, as returned from <code>Y.on</code> or <code>Y.after</code>.
     * @property _itemHandles
     * @private
     * @type Array
     */
    _itemsHandles: {},
    
    
    /**
     * Removes all handles, attched to given item
     *
     * @method _removeItemHandles
     * @protected
     * @param {Y.AccordionItem} item The item, which handles to remove
     */
    _removeItemHandles: function( item ){
        var itemHandles, itemHandle;
        
        itemHandles = this._itemsHandles[ item ];

        for( itemHandle in itemHandles ){
            if( itemHandles.hasOwnProperty( itemHandle ) ){
                itemHandle = itemHandles[ itemHandle ];
                itemHandle.detach();
            }
        }

        delete this._itemsHandles[ item ];
    },
    
    /**
     * Obtains the precise height of the node provided, including padding and border.
     *
     * @method _getNodeOffsetHeight
     * @protected
     * @param {Node|HTMLElement} node The node to gather the height from
     * @return {Number} The calculated height or zero in case of failure
     */
    _getNodeOffsetHeight: function( node ){
        var height, preciseRegion;

        if( node instanceof Node ){
            if( node.hasMethod( "getBoundingClientRect" ) ){
                preciseRegion = node.invoke( "getBoundingClientRect" );

                if( preciseRegion ){
                    height = preciseRegion.bottom - preciseRegion.top;

                    return height;
                }
            } else {
                height = node.get( "offsetHeight" );
                return Y.Lang.isValue( height ) ? height : 0;
            }
        } else if( node ){
            height = node.offsetHeight;
            return Y.Lang.isValue( height ) ? height : 0;
        }

        return 0;
    },


    /**
     * Updates expand and alwaysVisible properties of given item with the values provided.
     * The properties will be updated only if needed.
     *
     * @method _setItemProperties
     * @protected
     * @param {Y.AccordionItem} item The item, which properties should be updated
     * @param {boolean} expanding The new value of "expanded" property
     * @param {boolean} alwaysVisible The new value of "alwaysVisible" property
     */
    _setItemProperties: function( item, expanding, alwaysVisible ){
        var curAlwaysVisible, curExpanded;

        curAlwaysVisible = item.get( ALWAYSVISIBLE );
        curExpanded = item.get( EXPANDED );

        if( expanding != curExpanded ){
            item.set( EXPANDED, expanding, {
                internalCall: true
            });
        }

        if( alwaysVisible !== curAlwaysVisible ){
            item.set( ALWAYSVISIBLE, alwaysVisible, {
                internalCall: true
            });
        }
    },

    
    /**
     * Updates user interface of an item and marks it as expanded, alwaysVisible or both
     *
     * @method _setItemUI
     * @protected
     * @param {Y.AccordionItem} item The item, which user interface should be updated
     * @param {boolean} expanding If true, the item will be marked as expanded.
     * If false, the item will be marked as collapsed
     * @param {boolean} alwaysVisible If true, the item will be marked as always visible.
     * If false, the always visible mark will be removed
     */
    _setItemUI: function( item, expanding, alwaysVisible ){
        item.markAsExpanded( expanding );
        item.markAsAlwaysVisible( alwaysVisible );
    },


    /**
     * Sets listener to resize event
     *
     * @method _afterRender
     * @protected
     * @param e {Event} after render custom event
     */
    _afterRender: function( e ){
        var resizeEvent;

        resizeEvent = this.get( "resizeEvent" );

        this._setUpResizing( resizeEvent );

        this.after( "resizeEventChange", Y.bind( this._afterResizeEventChange, this ) );
    },


    /**
     * Set up resizing with the new value provided
     *
     * @method _afterResizeEventChange
     * @param params {Event} after resizeEventChange custom event
     */
    _afterResizeEventChange: function( params ){
        this._setUpResizing( params.newValue );
    },

    
    /**
     * Distributes the involved items as result of user interaction on item header.
     * Some items might be stored in the list for collapsing, other in the list for expanding. 
     * Finally, invokes <code>_processItems</code> function, except if item has been expanded and
     * user has clicked on always visible icon.
     * If the user clicked on close icon, the item will be closed.
     *
     * @method _onItemChosen
     * @protected
     * @param item {Y.AccordionItem} The item on which user has clicked or pressed key
     * @param srcIconAlwaysVisible {Boolean} True if the user has clicked on always visible icon
     * @param srcIconClose {Boolean} True if the user has clicked on close icon
     */
    _onItemChosen: function( item, srcIconAlwaysVisible, srcIconClose ){
        var toBeExcluded, alwaysVisible, expanded, collapseOthersOnExpand;

        toBeExcluded = {};        
        collapseOthersOnExpand = this.get( COLLAPSEOTHERSONEXPAND );
        alwaysVisible = item.get( ALWAYSVISIBLE );
        expanded      = item.get( EXPANDED );

        if( srcIconClose ){
            this.removeItem( item );
            return;
        } else if( srcIconAlwaysVisible ){
            if( expanded ){
                alwaysVisible = !alwaysVisible;
                expanded = alwaysVisible ? true : expanded;

                this._setItemProperties( item, expanded, alwaysVisible );
                this._setItemUI( item, expanded, alwaysVisible );

                return;
            } else {
                this._forExpanding[ item ] = {
                    'item': item,
                    alwaysVisible: true
                };

                if( collapseOthersOnExpand ){
                    toBeExcluded[ item ] = {
                        'item': item
                    };

                    this._storeItemsForCollapsing( toBeExcluded );
                }
            }
        } else {
            /*
             * Do the opposite
             */
            if( expanded ){
                this._forCollapsing[ item ] = {
                    'item': item
                };
            } else {
                this._forExpanding[ item ] = {
                    'item': item,
                    'alwaysVisible': alwaysVisible
                };

                if( collapseOthersOnExpand ){
                    toBeExcluded[ item ] = {
                        'item': item
                    };

                    this._storeItemsForCollapsing( toBeExcluded );
                }
            }
        }

        this._processItems();
    },

    
    /**
     * Helper method to adjust the height of all items, which <code>contentHeight</code> property is set as "stretch".
     * If some item has animation running, it will be stopped before running another one.
     * 
     * @method adjustStretchItems
     * @protected
     * @return {Number} The calculated height per strech item
     */
    _adjustStretchItems: function(){
        var items = this.get( ITEMS ), heightPerStretchItem;

        heightPerStretchItem = this._getHeightPerStretchItem();
        
        Y.Array.each( items, function( item, index, items ){
            var body, bodyHeight, anim, heightSettings, expanded;

            heightSettings = item.get( CONTENT_HEIGHT );
            expanded      = item.get( EXPANDED );

            if( heightSettings.method === STRETCH && expanded ){
                anim = this._animations[ item ];

                // stop waiting animation
                if( anim ){
                    anim.stop();
                }

                body = item.getStdModNode( WidgetStdMod.BODY );
                bodyHeight = this._getNodeOffsetHeight( body );

                if( heightPerStretchItem < bodyHeight ){
                    this._processCollapsing( item, heightPerStretchItem );
                } else if( heightPerStretchItem > bodyHeight ){
                    this._processExpanding( item, heightPerStretchItem );
                }
            }
        }, this );

        return heightPerStretchItem;
    },

    /**
     * Calculates the height per strech item.
     * 
     * @method _getHeightPerStretchItem
     * @protected
     * @return {Number} The calculated height per strech item
     */
    _getHeightPerStretchItem: function(){
        var height, items, stretchCounter = 0;

        items = this.get( ITEMS );
        height = this.get( BOUNDING_BOX ).get( "clientHeight" );

        Y.Array.each( items, function( item, index, items ){
            var collapsed, itemContentHeight, header, heightSettings, headerHeight;

            header = item.getStdModNode( WidgetStdMod.HEADER );
            heightSettings = item.get( CONTENT_HEIGHT );
            
            headerHeight = this._getNodeOffsetHeight( header );

            height -= headerHeight;
            collapsed = !item.get( EXPANDED );

            if( collapsed ){
                height -= COLLAPSE_HEIGHT;
                return;
            }

            if( heightSettings.method === STRETCH ){
                stretchCounter++;
            } else {
                itemContentHeight = this._getItemContentHeight( item );
                height -= itemContentHeight;
            }
        }, this );

        if( stretchCounter > 0 ){
            height /= stretchCounter;
        }

        if( height < 0 ){
            height = 0;
        }

        return height;
    },

    
    /**
     * Calculates the height of given item depending on its "contentHeight" property.
     * 
     * @method _getItemContentHeight
     * @protected
     * @param item {Y.AccordionItem} The item, which height should be calculated
     * @return {Number} The calculated item's height
     */
    _getItemContentHeight: function( item ){
        var heightSettings, height = 0, body, bodyContent;

        heightSettings = item.get( CONTENT_HEIGHT );

        if( heightSettings.method === "auto" ){
            body = item.getStdModNode( WidgetStdMod.BODY );
            bodyContent = body.get( CHILDREN ).item(0);
            height = bodyContent ? this._getNodeOffsetHeight( bodyContent ) : 0;
        } else if( heightSettings.method === "fixed" ) {
            height = heightSettings.height;
        } else {
            height = this._getHeightPerStretchItem();
        }

        return height;
    },

    
    /**
     * Stores all items, which are expanded and not set as always visible in list
     * in order to be collapsed later.
     * 
     * @method _storeItemsForCollapsing
     * @protected
     * @param {Object} itemsToBeExcluded (optional) Contains one or more <code>Y.AccordionItem</code> instances,
     * which should be not included in the list
     */
    _storeItemsForCollapsing: function( itemsToBeExcluded ){
        var items;

        itemsToBeExcluded = itemsToBeExcluded || {};
        items = this.get( ITEMS );

        Y.Array.each( items, function( item, index, items ){
            var expanded, alwaysVisible;

            expanded = item.get( EXPANDED );
            alwaysVisible = item.get( ALWAYSVISIBLE );

            if( expanded && !alwaysVisible && !itemsToBeExcluded[ item ] ){
                this._forCollapsing[ item ] = {
                    'item': item
                };
            }
        }, this );
    },

    
    /**
     * Expands an item to given height. This includes also an update to item's user interface
     * 
     * @method _expandItem
     * @protected
     * @param {Y.AccordionItem} item The item, which should be expanded
     * @param {Number} height The height to which we should expand the item
     */
    _expandItem: function( item, height ){
        var alwaysVisible = item.get( ALWAYSVISIBLE );

        this._processExpanding( item, height );
        this._setItemUI( item, true, alwaysVisible );
    },

    
    /**
     * Expands an item to given height. Depending on the <code>useAnimation</code> setting, 
     * the process of expanding might be animated. This setting will be ignored, if <code>forceSkipAnimation</code> param
     * is <code>true</code>.
     * 
     * @method _processExpanding
     * @protected
     * @param {Y.AccordionItem} item An <code>Y.AccordionItem</code> instance to be expanded
     * @param {Boolean} forceSkipAnimation If true, the animation will be skipped, 
     * without taking in consideration Accordion's <code>useAnimation</code> setting
     * @param {Number} height The height to which item should be expanded
     */
    _processExpanding: function( item, height, forceSkipAnimation ){
        var anim, curAnim, animSettings, notifyOthers = false,
            accAnimationSettings, body;
        
        body = item.getStdModNode( WidgetStdMod.BODY );

        this.fire( BEFOREITEMERESIZED, {
            'item': item
        });

        if( body.get( "clientHeight" ) <= 0 ){
            notifyOthers = true;
            this.fire( BEFOREITEMEXPAND, {
                'item': item
            });
        }

        if( !forceSkipAnimation && this.get( "useAnimation" ) ){
            animSettings = item.get( ANIMATION ) || {};

            anim = new Anim( {
                node: body,
                to: {
                    'height': height
                }
            });

            anim.on( "end", Y.bind( this._onExpandComplete, this, item, notifyOthers ) );

            accAnimationSettings = this.get( ANIMATION );

            anim.set( "duration", animSettings.duration || accAnimationSettings.duration );
            anim.set( "easing"  , animSettings.easing   || accAnimationSettings.easing   );
            
            curAnim = this._animations[ item ];
            
            if( curAnim ){
                curAnim.stop();
            }

            item.markAsExpanding( true );

            this._animations[ item ] = anim;

            anim.run();
        } else {
            body.setStyle( "height", height + PX );

            this.fire( ITEMERESIZED, {
                'item': item
            });

            if( notifyOthers ){
                this.fire( ITEMEXPANDED, {
                    'item': item
                });
            }
        }
    },


    /**
     * Executes when animated expanding completes
     *
     * @method _onExpandComplete
     * @protected
     * @param {Y.AccordionItem} item An <code>Y.AccordionItem</code> instance which has been expanded
     * @param {Boolean} notifyOthers If true, itemExpanded event will be fired
     */
    _onExpandComplete: function( item, notifyOthers ){
        delete this._animations[ item ];

        item.markAsExpanding( false );

        this.fire( ITEMERESIZED, {
            'item': item
        });

        if( notifyOthers ){
            this.fire( ITEMEXPANDED, {
                'item': item
            });
        }
    },

    
    /**
     * Collapse an item and update its user interface
     * 
     * @method _collapseItem
     * @protected
     * @param {Y.AccordionItem} item The item, which should be collapsed
     */
    _collapseItem: function( item ){
        this._processCollapsing( item, COLLAPSE_HEIGHT );
        this._setItemUI( item, false, false );
    },

    
    /**
     * Collapse an item to given height. Depending on the <code>useAnimation</code> setting, 
     * the process of collapsing might be animated. This setting will be ignored, if <code>forceSkipAnimation</code> param
     * is <code>true</code>.
     * 
     * @method _processCollapsing
     * @protected
     * @param {Y.AccordionItem} item An <code>Y.AccordionItem</code> instance to be collapsed
     * @param {Number} height The height to which item should be collapsed
     * @param {Boolean} forceSkipAnimation If true, the animation will be skipped, 
     * without taking in consideration Accordion's <code>useAnimation</code> setting
     */
    _processCollapsing: function( item, height, forceSkipAnimation ){
        var anim, curAnim, animSettings, accAnimationSettings, body, 
            notifyOthers = (height === COLLAPSE_HEIGHT);
            
        body = item.getStdModNode( WidgetStdMod.BODY );

        
        this.fire( BEFOREITEMERESIZED, {
            'item': item
        });

        if( notifyOthers ){
            this.fire( BEFOREITEMCOLLAPSE, {
                'item': item
            });
        }

        if( !forceSkipAnimation && this.get( "useAnimation" ) ){
            animSettings = item.get( ANIMATION ) || {};

            anim = new Anim( {
                node: body,
                to: {
                    'height': height
                }
            });

            anim.on( "end", Y.bind( this._onCollapseComplete, this, item, notifyOthers ) );

            accAnimationSettings = this.get( ANIMATION );

            anim.set( "duration", animSettings.duration || accAnimationSettings.duration );
            anim.set( "easing"  , animSettings.easing   || accAnimationSettings.easing );

            curAnim = this._animations[ item ];
            
            if( curAnim ){
                curAnim.stop();
            }
            
            item.markAsCollapsing( true );

            this._animations[ item ] = anim;

            anim.run();
        } else {
            body.setStyle( "height", height + PX );

            this.fire( ITEMERESIZED, {
                'item': item
            });

            if( notifyOthers ){
                this.fire( ITEMCOLLAPSED, {
                    'item': item
                });
            }
        }
    },


    /**
     * Executes when animated collapsing completes
     *
     * @method _onCollapseComplete
     * @protected
     * @param {Y.AccordionItem} item An <code>Y.AccordionItem</code> instance which has been collapsed
     * @param {Boolean} notifyOthers If true, itemCollapsed event will be fired
     */
    _onCollapseComplete: function( item, notifyOthers ){
        delete this._animations[ item ];

        item.markAsCollapsing( false );

        this.fire( ITEMERESIZED, {
            item: item
        });

        if( notifyOthers ){
            this.fire( ITEMCOLLAPSED, {
                'item': item
            });
        }
    },

    
    /**
     * Make an item draggable. The item can be reordered later.
     * 
     * @method _initItemDragDrop
     * @protected
     * @param {Y.AccordionItem} item An <code>Y.AccordionItem</code> instance to be set as draggable
     */
    _initItemDragDrop: function( item ){
        var itemHeader, dd, bb, itemBB, ddrop;

        itemHeader = item.getStdModNode( WidgetStdMod.HEADER );

        if( itemHeader.dd ){
            return;
        }

        bb = this.get( BOUNDING_BOX );
        itemBB = item.get( BOUNDING_BOX );

        dd = new Y.DD.Drag({
            node: itemHeader,
            groups: [ DRAGGROUP ]
        }).plug(Y.Plugin.DDProxy, {
            moveOnEnd: false
        }).plug(Y.Plugin.DDConstrained, {
            constrain2node: bb
        });

        ddrop = new Y.DD.Drop({
            node: itemBB,
            groups: [ DRAGGROUP ]
        });

        dd.on   ( "drag:start",   Y.bind( this._onDragStart,  this, dd ) );
        dd.on   ( "drag:end"  ,   Y.bind( this._onDragEnd,    this, dd ) );
        dd.after( "drag:end"  ,   Y.bind( this._afterDragEnd, this, dd ) );
        dd.on   ( "drag:drophit", Y.bind( this._onDropHit,    this, dd ) );
    },


    /**
     * Sets the label of the item being dragged on the drag proxy.
     * Fires beforeItemReorder event - returning false will cancel reordering
     *
     * @method _onDragStart
     * @protected
     * @param {Y.DD.Drag} The drag instance of the item
     * @param e {Event} the DD instance's drag:start custom event
     */
    _onDragStart: function( dd, e ){
        var dragNode, item;

        item = this.getItem( dd.get( NODE ).get( PARENT_NODE ) );
        dragNode = dd.get( "dragNode" );

        dragNode.addClass( C_PROXY_VISIBLE );
        dragNode.set( "innerHTML", item.get( "label" ) );

        return this.fire( BEFOREITEMREORDER, { 'item': item } );
    },


    /**
     * Restores HTML structure of the drag proxy.
     * Fires beforeEndItemReorder event - returning false will cancel reordering
     *
     * @method _onDragEnd
     * @protected
     * @param {Y.DD.Drag} The drag instance of the item
     * @param e {Event} the DD instance's drag:end custom event
     */
    _onDragEnd: function( dd, e ){
        var dragNode, item;

        dragNode = dd.get( "dragNode" );

        dragNode.removeClass( C_PROXY_VISIBLE );
        dragNode.set( "innerHTML", "" );

        item = this.getItem( dd.get( NODE ).get( PARENT_NODE ) );
        return this.fire( BEFOREENDITEMREORDER, { 'item': item } );
    },


    /**
     * Set drophit to false in dragdrop instance's custom value (if there has been drophit) and fires itemReordered event
     *
     * @method _afterDragEnd
     * @protected
     * @param {Y.DD.Drag} The drag instance of the item
     * @param e {Event} the DD instance's drag:end custom event
     */
    _afterDragEnd: function( dd, e ){
        var item, data;

        data = dd.get( DATA );

        if( data.drophit ){
            item = this.getItem( dd.get( NODE ).get( PARENT_NODE ) );

            dd.set( DATA, {
                drophit: false
            } );

            return this.fire( ITEMREORDERED, { 'item': item } );
        }

        return true;
    },


    /**
     * Moves the source item before or after target item.
     *
     * @method _onDropHit
     * @param {Y.DD.Drag} The drag instance of the item
     * @param e {Event} the DD instance's drag:drophit custom event
     */
    _onDropHit: function( dd, e) {
        var mineIndex, targetItemIndex, targetItemBB, itemBB, cb,
            goingUp, items, targetItem, item;

        item = this.getItem( dd.get( NODE ).get( PARENT_NODE ) );
        targetItem = this.getItem( e.drop.get( NODE ) );

        if( targetItem === item ){
            return false;
        }

        mineIndex = this.getItemIndex( item );
        targetItemIndex = this.getItemIndex( targetItem );
        targetItemBB = targetItem.get( BOUNDING_BOX );
        itemBB = item.get( BOUNDING_BOX );
        cb = this.get( CONTENT_BOX );
        goingUp = false;
        items = this.get( ITEMS );

        if( targetItemIndex < mineIndex ){
            goingUp = true;
        }

        cb.removeChild( itemBB );

        if( goingUp ){
            cb. insertBefore( itemBB, targetItemBB );
            items.splice( mineIndex, 1 );
            items.splice( targetItemIndex, 0, item );
        } else {
            cb. insertBefore( itemBB, targetItemBB.next( C_ITEM ) );
            items.splice( targetItemIndex + 1, 0, item );
            items.splice( mineIndex, 1 );
        }

        dd.set( DATA, {
            drophit: true
        });

        return true;
    },

    
    /**
     * Process items as result of user interaction or properties change.
     * This includes four steps:
     * 1. Update the properties of the items
     * 2. Collapse all items stored in the list for collapsing
     * 3. Adjust all stretch items
     * 4. Expand items stored in the list for expanding
     * 
     * @method _processItems
     * @protected
     */
    _processItems: function(){
        var forCollapsing, forExpanding, itemCont, heightPerStretchItem, 
            height, heightSettings, item;

        forCollapsing = this._forCollapsing;
        forExpanding = this._forExpanding;

        this._setItemsProperties();

        for( item in forCollapsing ){
            if( forCollapsing.hasOwnProperty( item ) ){
                itemCont = forCollapsing[ item ];

                this._collapseItem( itemCont.item );
            }
        }

        heightPerStretchItem = this._adjustStretchItems();

        for( item in forExpanding ){
            if( forExpanding.hasOwnProperty( item ) ){
                itemCont = forExpanding[ item ];
                item = itemCont.item;
                height = heightPerStretchItem;
                heightSettings = item.get( CONTENT_HEIGHT );

                if( heightSettings.method !== STRETCH ){
                    height = this._getItemContentHeight( item );
                }

                this._expandItem( item, height );
            }
        }

        this._forCollapsing = {};
        this._forExpanding = {};
    },

    
    /**
     * Update properties of items, which were stored in the lists for collapsing or expanding
     * 
     * @method _setItemsProperties
     * @protected
     */
    _setItemsProperties: function (){
        var forCollapsing, forExpanding, itemData;

        forCollapsing = this._forCollapsing;
        forExpanding = this._forExpanding;

        for( itemData in forCollapsing ){
            if( forCollapsing.hasOwnProperty( itemData ) ){
                itemData = forCollapsing[ itemData ];
                this._setItemProperties( itemData.item, false, false );
            }
        }

        for( itemData in forExpanding ){
            if( forExpanding.hasOwnProperty( itemData ) ){
                itemData = forExpanding[ itemData ];
                this._setItemProperties( itemData.item, true, itemData.alwaysVisible );
            }
        }
    },


    /**
     * Handles the change of "expand" property of given item
     * 
     * @method _afterItemExpand
     * @protected
     * @param {EventFacade} params The event facade for the attribute change
     */
    _afterItemExpand: function( params ){
        var expanded, item, alwaysVisible, collapseOthersOnExpand;

        if( params.internalCall ){
            return;
        }
        
        expanded = params.newVal;
        item    = params.currentTarget;
        alwaysVisible = item.get( ALWAYSVISIBLE );
        collapseOthersOnExpand = this.get( COLLAPSEOTHERSONEXPAND );
        
        if( expanded ){
            this._forExpanding[ item ] = {
                'item': item,
                'alwaysVisible': alwaysVisible
            };
            
            if( collapseOthersOnExpand ){
                this._storeItemsForCollapsing();
            }
        } else {
            this._forCollapsing[ item ] = {
                'item': item
            };
        }
        
        this._processItems();
    },

    /**
     * Handles the change of "alwaysVisible" property of given item
     * 
     * @method _afterItemAlwaysVisible
     * @protected
     * @param {EventFacade} params The event facade for the attribute change
     */
    _afterItemAlwaysVisible: function( params ){
        var item, alwaysVisible, expanded;
        
        if( params.internalCall ){
            return;
        }

        alwaysVisible = params.newVal;
        item         = params.currentTarget;
        expanded     = item.get( EXPANDED );

        if( alwaysVisible ){
            if( expanded ){
                this._setItemProperties( item, true, true );
                this._setItemUI( item, true, true );
                return;
            } else {
                this._forExpanding[ item ] = {
                    'item': item,
                    'alwaysVisible': true
                };

                this._storeItemsForCollapsing();
            }
        } else {
            if( expanded ){
                this._setItemUI( item, true, false );
                return;
            } else {
                return;
            }
        }
        
        this._processItems();
    },
    
    
    /**
     * Handles the change of "contentHeight" property of given item
     * 
     * @method _afterContentHeight
     * @protected
     * @param {EventFacade} params The event facade for the attribute change
     */
    _afterContentHeight: function( params ){
        var item, itemContentHeight, body, bodyHeight, expanded;
        
        item = params.currentTarget;
        
        this._adjustStretchItems();
        
        if( params.newVal.method !== STRETCH ){
            expanded = item.get( EXPANDED );
            itemContentHeight = this._getItemContentHeight( item );
            
            body = item.getStdModNode( WidgetStdMod.BODY );
            bodyHeight = this._getNodeOffsetHeight( body );
            
            if( itemContentHeight < bodyHeight ){
                this._processCollapsing( item, itemContentHeight, !expanded );
            } else if( itemContentHeight > bodyHeight ){
                this._processExpanding( item, itemContentHeight, !expanded );
            }
        }
    },
    
    
    
    /**
     * Subscribe for resize event, which could be provided from the browser or from an arbitrary object.
     * For example, if there is LayoutManager in the page, it is preferable to subscribe to its resize event,
     * instead to those, which browser provides.
     * 
     * @method _setUpResizing
     * @protected
     * @param {String|Object} String "default" or object with the following properties:
     *  <dl>
     *      <dt>sourceObject</dt>
     *          <dd>An abbitrary object</dd>
     *      <dt>resizeEvent</dt>
     *          <dd>The name of its resize event</dd>
     *  </dl>
     */
    _setUpResizing: function( value ){
        if( this._resizeEventHandle ){
            this._resizeEventHandle.detach();
        }

        if( value === DEFAULT ){
            this._resizeEventHandle = Y.on( 'windowresize', Y.bind( this._adjustStretchItems, this ) );
        } else {
            this._resizeEventHandle = value.sourceObject.on( value.resizeEvent, Y.bind( this._adjustStretchItems, this ) );
        }
    },

    
    /**
     * Creates one or more items found in Accordion's <code>contentBox</code>
     * 
     * @method renderUI
     * @protected
     */
    renderUI: function(){
        var cb, itemsDom;

        cb = this.get( CONTENT_BOX );
        itemsDom = cb.queryAll( "> div." + C_ITEM );

        itemsDom.each( function( itemNode, index, itemsDom ){
            var newItem;

            if( !this.getItem( itemNode ) ){
                newItem = new Y.AccordionItem({
                    contentBox: itemNode
                });

                this.addItem( newItem );
            }
        }, this );
    },

    
    /**
     * Add listener to <code>itemChosen</code> and <code>keypress</code> events in Accordion's content box
     * 
     * @method bindUI
     * @protected
     */
    bindUI: function(){
        var contentBox, itemChosenEvent;

        contentBox = this.get( CONTENT_BOX );
        itemChosenEvent = this.get( 'itemChosen' );
        
        contentBox.delegate( itemChosenEvent, Y.bind( this._onItemChosenEvent, this ), 'div.yui-widget-hd' );
        contentBox.delegate( "keypress", Y.bind( this._onKeyPressEvent, this ), 'div.yui-widget-hd' );
    },


    /**
     * Listening for itemChosen event, determines the source (is that iconClose, iconAlwaysVisisble, etc.) and
     * invokes this._onItemChosen for further processing
     *
     * @method _onItemChosenEvent
     * @protected
     * 
     * @param e {Event} The itemChosen event
     */
    _onItemChosenEvent: function(e){
        var header, itemNode, item, iconAlwaysVisible,
            iconClose, srcIconAlwaysVisible, srcIconClose;

        header = e.currentTarget;
        itemNode = header.get( PARENT_NODE );
        item = this.getItem( itemNode );
        iconAlwaysVisible = item.get( ICON_ALWAYSVISIBLE );
        iconClose = item.get( ICON_CLOSE );
        srcIconAlwaysVisible = (iconAlwaysVisible === e.target);
        srcIconClose = (iconClose === e.target);

        this._onItemChosen( item, srcIconAlwaysVisible, srcIconClose );
    },


    /**
     * Listening for Enter key and process the item depending on the source (iconClose, iconAlwaysVisisble, etc.)
     *
     * @method _onKeyPressEvent
     * @protected
     *
     * @param e {Event} The keypress event
     */
    _onKeyPressEvent: function(e){
        var header, itemNode, item, iconAlwaysVisible,
            iconClose, srcIconAlwaysVisible, srcIconClose,
            charCode, target = e.target, srcIconExtended, iconExtended;

        charCode = e.charCode;

        if( charCode === 13 ){
            header = e.currentTarget;
            itemNode = header.get( PARENT_NODE );
            item = this.getItem( itemNode );

            iconAlwaysVisible = item.get( ICON_ALWAYSVISIBLE );
            iconExtended = item.get( "iconExtended" );
            iconClose = item.get( ICON_CLOSE );
            srcIconAlwaysVisible = (iconAlwaysVisible === target);
            srcIconExtended = (iconExtended === target );
            srcIconClose = (iconClose === e.target);

            /**
             * Exclude label in order to avoid double function invocation.
             * Label keypress will be managed in "click" listener.
             */
            if( srcIconExtended || srcIconAlwaysVisible  || srcIconClose ){
                this._onItemChosen( item, srcIconAlwaysVisible, srcIconClose );
            }
        }
    },

    
    /**
     * Add an item to Accordion. Items could be added/removed multiple times and they
     * will be rendered in the process of adding, if not.
     * The item will be expanded, collapsed, or set as always visible depending on the 
     * settings. Item's properties will be also updated, if they are incomplete.
     * For example, if <code>alwaysVisible</code> is true, but <code>expanded</code>
     * property is false, it will be set to true also.
     * 
     * If the second param, <code>parentItem</code> is an <code>Y.AccordionItem</code> instance,
     * registered in Accordion, the item will be added as child of the <code>parentItem</code>
     * 
     * @method addItem
     * @param {Y.AccordionItem} item The item to be added in Accordion
     * @param {Y.AccordionItem} parentItem (optional) This item will be the parent of the item being added
     * 
     * @return Boolean True in case of successfully added item, false otherwise
     */
    addItem: function( item, parentItem ){
        var expanded, alwaysVisible, bodyContent, itemIndex, items, contentBox,
            itemHandles, itemContentBox, res, cb, children, itemBoundingBox;

        res = this.fire( BEFOREITEMADD, {
            'item': item
        });

        if( !res ){
            return false;
        }

        items = this.get( ITEMS );
        contentBox = this.get( CONTENT_BOX );

        itemContentBox  = item.get( CONTENT_BOX );
        itemBoundingBox = item.get( BOUNDING_BOX );

        if( !itemContentBox.inDoc() ){
            if( parentItem ){
                itemIndex = this.getItemIndex( parentItem );

                if( itemIndex < 0 ){
                    return false;
                }

                items.splice( itemIndex, 0, item );

                if( item.get( RENDERED ) ){
                    contentBox.insertBefore( itemBoundingBox, parentItem.get( BOUNDING_BOX ) );
                } else {
                    contentBox.insertBefore( itemContentBox, parentItem.get( BOUNDING_BOX ) );
                }
            } else {
                items.push( item );

                if( item.get( RENDERED ) ){
                    contentBox.insertBefore( itemBoundingBox, null );
                } else {
                    contentBox.insertBefore( itemContentBox, null );
                }
            }
        } else {
            cb = this.get( CONTENT_BOX );
            children = cb.get( CHILDREN );

            res = children.some( function( node, index, nodeList ){
                if( node === itemContentBox ){
                    items.splice( index, 0, item );
                    return true;
                } else {
                    return false;
                }
            }, this );

            if( !res ){
                return false;
            }
        }

        bodyContent = item.get( BODYCONTENT );

        if( !bodyContent ){
            item.set( BODYCONTENT, "&nbsp;" );
        }

        if( !item.get( RENDERED ) ){
            item.render();
        }
        
        expanded = item.get( EXPANDED );
        alwaysVisible = item.get( ALWAYSVISIBLE );

        expanded = expanded || alwaysVisible;

        if( expanded ){
            this._forExpanding[ item ] = {
                'item': item,
                'alwaysVisible': alwaysVisible
            };
        } else {
            this._forCollapsing[ item ] = {
                'item': item
            };
        }

        this._processItems();

        if( this.get( "reorderItems" ) ){
            this._initItemDragDrop( item );
        }
        
        itemHandles = this._itemsHandles[ item ];
        
        if( !itemHandles ){
            itemHandles = {};
        }
        
        itemHandles = {
            "expandedChange" : item.after( "expandedChange", Y.bind( this._afterItemExpand, this ) ),
            "alwaysVisibleChange" : item.after( "alwaysVisibleChange", Y.bind( this._afterItemAlwaysVisible, this ) ),
            "contentHeightChange" : item.after( "contentHeightChange", Y.bind( this._afterContentHeight, this ) )
        };
        
        this._itemsHandles[ item ] = itemHandles;

        this.fire( ITEMADDED, {
            'item': item
        });

        return true;
    },

    
    /**
     * Removes an previously registered item in Accordion
     * 
     * @method removeItem
     * @param {Y.AccordionItem|Number} p_item The item to be removed, or its index
     * @return Y.AccordionItem The removed item or null if not found
     */
    removeItem: function( p_item ){
        var items, bb, item = null, itemIndex;
        
        items = this.get( ITEMS );
        
        if( Lang.isNumber( p_item ) ){
            itemIndex = p_item;
        } else if( p_item instanceof Y.AccordionItem ){
            itemIndex = this.getItemIndex( p_item );
        } else {
            return null;
        }

        if( itemIndex >= 0 ){
            
            this.fire( BEFOREITEMREMOVE, {
                item: p_item
            });

            item = items.splice( itemIndex, 1 )[0];

            this._removeItemHandles( item );
            
            bb = item.get( BOUNDING_BOX );
            bb.remove();

            this._adjustStretchItems();
            
            this.fire( ITEMREMOVED, {
                item: p_item
            });
        }

        return item;
    },

    
    /**
     * Searching for item, previously registered in Accordion
     * 
     * @method getItem
     * @param {Number|Y.Node} param If number, this must be item's index.
     * If Node, it should be the value of item's <code>contentBox</code> or <code>boundingBox</code> properties
     * 
     * @return Y.AccordionItem The found item or null
     */
    getItem: function( param ){
        var items = this.get( ITEMS ), item = null;

        if( Lang.isNumber( param ) ){
            item = items[ param ];

            return (item instanceof Y.AccordionItem) ? item : null;
        } else if( param instanceof Node ){

            Y.Array.some( items, function( tmpItem, index, items ){
                var contentBox, boundingBox;
                
                contentBox = tmpItem.get( CONTENT_BOX );
                boundingBox = tmpItem.get( BOUNDING_BOX );

                if( contentBox === param ){
                    item = tmpItem;
                    return true;
                } else if( boundingBox === param ){
                    item = tmpItem;
                    return true;
                } else {
                    return false;
                }
            }, this );
        }

        return item;
    },

    
    /**
     * Looking for the index of previously registered item
     * 
     * @method getItemIndex
     * @param {Y.AccordionItem} item The item which index should be returned
     * @return Number Item index or <code>-1</code> if item has been not found
     */
    getItemIndex: function( item ){
        var res = -1, items;

        if( item instanceof Y.AccordionItem ){
            items = this.get( ITEMS );

            Y.Array.some( items, function( tmpItem, index, items ){
                if( tmpItem === item ){
                    res = index;
                    return true;
                } else {
                    return false;
                }
            }, this );
        }

        return res;
    }
    
});

Y.Accordion = Accordion;

}());

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
    getCN = Y.ClassNameManager.getClassName,
    
    DEFAULT_ICON = "default",

    C_TABLE = getCN( AccItemName, "table" ),
    C_TD_ICON = getCN( AccItemName, "td", "icon" ),
    C_TD_LABEL = getCN( AccItemName, "td", "label" ),

    C_TD_ICONALWAYSVISIBLE = getCN( AccItemName, "td", "iconalwaysvisible" ),
    C_TD_ICONEXTENDED = getCN( AccItemName, "td", "iconextended" ),
    C_TD_ICONCLOSE = getCN( AccItemName, "td", "iconclose" ),
    C_TD_ICONCLOSE_HIDDEN = getCN( AccItemName, "td", "iconclose", "hidden" ),

    C_ICONEXTENDED_EXPANDING = getCN( AccItemName, "iconextended", "expanding" ),
    C_ICONEXTENDED_COLLAPSING = getCN( AccItemName, "iconextended", "collapsing" ),

    C_ICON = getCN( AccItemName, "icon" ),
    C_LABEL = getCN( AccItemName, "label" ),
    C_ICONALWAYSVISIBLE = getCN( AccItemName, "iconalwaysvisible" ),
    C_ICONEXTENDED = getCN( AccItemName, "iconextended" ),
    C_ICONCLOSE = getCN( AccItemName, "iconclose" ),

    C_EXPANDED =  getCN( AccItemName, "expanded" ),
    C_CLOSABLE =  getCN( AccItemName, "closable" ),
    C_ALWAYSVISIBLE =  getCN( AccItemName, "alwaysvisible" ),
    C_CONTENTHEIGHT =  getCN( AccItemName, "contentheight" ),

    C_ICONEXTENDED_ON = getCN( AccItemName, "iconextended", "on" ),
    C_ICONEXTENDED_OFF = getCN( AccItemName, "iconextended", "off" ),

    C_ICONALWAYSVISIBLE_ON = getCN( AccItemName, "iconalwaysvisible", "on" ),
    C_ICONALWAYSVISIBLE_OFF = getCN( AccItemName, "iconalwaysvisible", "off" ),

    TITLE = "title",
    STRINGS = "strings",
    CONTENT_BOX = "contentBox",
    RENDERED = "rendered",
    CLASS_NAME = "className",
    AUTO = "auto",
    STRETCH = "stretch",
    FIXED = "fixed";

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
            method: AUTO
        },
        validator: function( value ){
            if( Lang.isObject( value ) ){
                if( value.method === AUTO ){
                    return true;
                } else if( value.method === STRETCH ){
                    return true;
                } else if( value.method === FIXED && Lang.isNumber( value.height ) &&
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
        
        labelClass = "> .yui-widget-hd > div." + C_LABEL;
        node = contentBox.query( labelClass );

        return (node) ? node.get( "innerHTML" ) : null;
    },

    icon: function ( contentBox ){
        var node, iconClass;
        
        iconClass = "> .yui-widget-hd > div." + C_ICON;
        node = contentBox.query( iconClass );

        if( node ){
            iconClass = node.get( CLASS_NAME );

            if( iconClass && Lang.isString( iconClass ) ){
                return iconClass;
            }
        }

        return null;
    },

    iconClose: function( contentBox ){
        var node, iconCloseClass;

        iconCloseClass = "> .yui-widget-hd > div." + C_ICONCLOSE;
        node = contentBox.query( iconCloseClass );

        if( node ){
            iconCloseClass = node.get( CLASS_NAME );

            if( iconCloseClass && Lang.isString( iconCloseClass ) ){
                return iconCloseClass;
            }
        }

        return null;
    },

    expanded: function( contentBox ){
        var expanded;

        expanded = contentBox.hasClass( C_EXPANDED );

        return expanded;
    },

    alwaysVisible: function( contentBox ){
        var alwaysVisible;

        alwaysVisible = contentBox.hasClass( C_ALWAYSVISIBLE );

        return alwaysVisible;
    },

    closable: function( contentBox ){
        var closable;

        closable = contentBox.hasClass( C_CLOSABLE );

        return closable;
    },

    contentHeight: function( contentBox ){
        var contentHeightClass, classValue, height = 0, i, length, index, chr;

        classValue = contentBox.get( CLASS_NAME );

        contentHeightClass = C_CONTENTHEIGHT + '-';

        index = classValue.indexOf( contentHeightClass, 0);

        if( index >= 0 ){
            length = classValue.length;
            index += contentHeightClass.length;

            classValue = classValue.substring( index );

            if( classValue.match( /^auto\s*/g ) ){
                return {
                    method: AUTO
                };
            } else if( classValue.match( /^stretch\s*/g ) ){
                return {
                    method: STRETCH
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
                    method: FIXED,
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

            if( icon === DEFAULT_ICON ){
                return C_ICON;
            } else {
                return icon;
            }
        }

        strings = this.get( STRINGS );
        closable = this.get( "closable" );

        html = [
            "<TABLE selectable='no' class='", C_TABLE, "'>",
            "<TBODY>",
            "<TR>",
                "<TD class='", C_TD_ICON, "'", " id='", Y.guid(), "'>",
                    "<div id='", Y.guid(), "' class='", setIcon.call(this), "' align='middle' ", "/>",
                "</TD>",
                "<TD class='" , C_TD_LABEL, "'>" ,
                    "<div class='" , C_LABEL, "'" ,
                       " id='", Y.guid(), "' ", ">",
                       "<a href='#'>", this.get( "label" ), "</a>",
                    "</div>",
                "</TD>",
                "<TD class='", C_TD_ICONALWAYSVISIBLE, "'", ">" ,
                    "<div tabindex='0' class='",
                        C_ICONALWAYSVISIBLE, " " , C_ICONALWAYSVISIBLE_OFF , "'",
                        " title='", strings.title_always_visible_off, "'",
                        " id='", Y.guid(), "'>",
                    "</div>",                    
                "</TD>",
                "<TD class='" , C_TD_ICONEXTENDED, "'>" ,
                    "<div tabindex='0' class='" , C_ICONEXTENDED, " ", C_ICONEXTENDED_OFF, "'",
                        " title='", strings.title_iconextended_off, "'",
                        " id='", Y.guid(), "'>",
                    "</div>",
                "</TD>",
                "<TD class='" , C_TD_ICONCLOSE, " ", (!closable ? C_TD_ICONCLOSE_HIDDEN : ""), "'>" ,
                    "<div tabindex='0' class='" , C_ICONCLOSE, "'",
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

        if( this.get( RENDERED ) ){
            if( icon === DEFAULT_ICON ){
                this._icon.set( CLASS_NAME, C_ICON );
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
        if( this.get( RENDERED ) ){
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

        if( this.get( RENDERED ) ){
            contentBox = this.get( CONTENT_BOX );
        
            selector = "> .yui-widget-hd ." + C_TD_ICONCLOSE;
            node = contentBox.query( selector );

            if( params.newVal ){
                node.removeClass( C_TD_ICONCLOSE_HIDDEN );
            } else {
                node.addClass( C_TD_ICONCLOSE_HIDDEN );
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
        this.after( "render", Y.bind( this._afterRender, this ) );
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
        var contentBox = this.get( CONTENT_BOX );

        this._icon = contentBox.query( "." + C_ICON );
        this._label = contentBox.query( "." + C_LABEL );
        this._iconAlwaysVisible = contentBox.query( "." + C_ICONALWAYSVISIBLE );
        this._iconExtended = contentBox.query( "." + C_ICONEXTENDED );
        this._iconClose = contentBox.query( "." + C_ICONCLOSE );
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
        
        contentBox = this.get( CONTENT_BOX );
        selector = [ 'div.', C_LABEL, ' a' ].join('');

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
        var strings = this.get( STRINGS );

        if( alwaysVisible ){
            if( !this._iconAlwaysVisible.hasClass( C_ICONALWAYSVISIBLE_ON ) ){
                this._iconAlwaysVisible.replaceClass( C_ICONALWAYSVISIBLE_OFF, C_ICONALWAYSVISIBLE_ON );
                this._iconAlwaysVisible.set( TITLE, strings.title_always_visible_on );
                return true;
            }
        } else {
            if( this._iconAlwaysVisible.hasClass( C_ICONALWAYSVISIBLE_ON ) ){
                this._iconAlwaysVisible.replaceClass( C_ICONALWAYSVISIBLE_ON, C_ICONALWAYSVISIBLE_OFF );
                this._iconAlwaysVisible.set( TITLE, strings.title_always_visible_off );
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
        var strings = this.get( STRINGS );

        if( expanded ){
            if( !this._iconExtended.hasClass( C_ICONEXTENDED_ON ) ){
                this._iconExtended.replaceClass( C_ICONEXTENDED_OFF, C_ICONEXTENDED_ON );
                this._iconExtended.set( TITLE , strings.title_iconextended_on );
                return true;
            }
        } else {
            if( this._iconExtended.hasClass( C_ICONEXTENDED_ON ) ){
                this._iconExtended.replaceClass( C_ICONEXTENDED_ON, C_ICONEXTENDED_OFF );
                this._iconExtended.set( TITLE , strings.title_iconextended_off );
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
            if( !this._iconExtended.hasClass( C_ICONEXTENDED_EXPANDING ) ){
                this._iconExtended.addClass( C_ICONEXTENDED_EXPANDING );
                return true;
            }
        } else {
            if( this._iconExtended.hasClass( C_ICONEXTENDED_EXPANDING ) ){
                this._iconExtended.removeClass( C_ICONEXTENDED_EXPANDING );
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
            if( !this._iconExtended.hasClass( C_ICONEXTENDED_COLLAPSING ) ){
                this._iconExtended.addClass( C_ICONEXTENDED_COLLAPSING );
                return true;
            }
        } else {
            if( this._iconExtended.hasClass( C_ICONEXTENDED_COLLAPSING ) ){
                this._iconExtended.removeClass( C_ICONEXTENDED_COLLAPSING );
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



}, '1.02' ,{requires:['event', 'anim-easing', 'dd-constrain', 'dd-proxy', 'dd-drop', 'widget', 'widget-stdmod']});

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
var Lang  = Y.Lang,
    Node  = Y.Node,
    Anim  = Y.Anim,
    Easing = Y.Easing,
    AccName = "accordion",
    WidgetStdMod = Y.WidgetStdMod,
    QuirksMode = document.compatMode == "BackCompat",
    IEQuirksMode = QuirksMode && Y.UA.ie > 0,
    COLLAPSE_HEIGHT = IEQuirksMode ? 1 : 0,
    getCN = Y.ClassNameManager.getClassName;


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
        value: "default",
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

/**
 *  Static property to indicate class which will be applied to dd proxy when item is being reordered
 *
 * @property Accordion.C_PROXY_VISIBLE
 * @type String
 * @static
 */
Accordion.C_PROXY_VISIBLE = getCN( AccName, "proxyel", "visible" );


/**
 * Static property, which contains the drag group for Accordion and its items
 *
 * @property Accordion.DRAGGROUP
 * @type String
 * @static
 */
Accordion.DRAGGROUP = "y_accordion";

/**
 * Static property; contains the events, which Accordion publishes
 *
 * @property Accordion.EVENT_TYPES
 * @type Object
 * @static
 */

Accordion.EVENT_TYPES = {

    BEFOREITEMADD: "beforeItemAdd",
    ITEMADDED: "itemAdded",

    BEFOREITEMREMOVE: "beforeItemRemove",
    ITEMREMOVED: "itemRemoved",

    BEFOREITEMERESIZED : "beforeItemResized",
    ITEMERESIZED : "itemResized",

    BEFOREITEMEXPAND  : "beforeItemExpand",
    BEFOREITEMCOLLAPSE : "beforeItemCollapse",
    ITEMEXPANDED : "itemExpanded",
    ITEMCOLLAPSED : "itemCollapsed",    

    BEFOREITEMREORDER : "beforeItemReorder",
    BEFOREENDITEMREORDER : "beforeEndItemReorder",
    ITEMREORDERED : "itemReordered"
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

        this.after( "render", function(){
            var resizeEvent;

            resizeEvent = this.get( "resizeEvent" );
            
            this._setUpResizing( resizeEvent );
            
            this.after( "resizeEventChange", function( data ) {
                this._setUpResizing( data.newVal );
            }, this );
        }, this );

        this._forCollapsing = {};
        this._forExpanding  = {};
        this._animations    = {};
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
        
        items = this.get( "items" );
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
        var events = Accordion.EVENT_TYPES;

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
        this.publish( events.BEFOREITEMADD );
        
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
        this.publish( events.ITEMADDED );
        
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
        this.publish( events.BEFOREITEMREMOVE );
        
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
        this.publish( events.ITEMREMOVED );

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
        this.publish( events.BEFOREITEMERESIZED );
        
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
        this.publish( events.ITEMERESIZED );

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
        this.publish( events.BEFOREITEMEXPAND );
        
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
        this.publish( events.BEFOREITEMCOLLAPSE );
        
        
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
        this.publish( events.ITEMEXPANDED );
        
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
        this.publish( events.ITEMCOLLAPSED );
        
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
        this.publish( events.BEFOREITEMREORDER );
        
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
        this.publish( events.BEFOREENDITEMREORDER );
        
        
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
        this.publish( events.ITEMREORDERED );
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

        curAlwaysVisible = item.get( "alwaysVisible" );
        curExpanded = item.get( "expanded" );

        if( expanding != curExpanded ){
            item.set( "expanded", expanding, {
                internalCall: true
            });
        }

        if( alwaysVisible !== curAlwaysVisible ){
            item.set( "alwaysVisible", alwaysVisible, {
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
        collapseOthersOnExpand = this.get( "collapseOthersOnExpand" );
        alwaysVisible  = item.get( "alwaysVisible" );
        expanded       = item.get( "expanded" );

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
        var items = this.get( "items" ), heightPerStretchItem;

        heightPerStretchItem = this._getHeightPerStretchItem();
        
        Y.Array.each( items, function( item, index, items ){
            var body, bodyHeight, anim, heightSettings, expanded;

            heightSettings = item.get( "contentHeight" );
            expanded       = item.get( "expanded" );

            if( heightSettings.method === "stretch" && expanded ){
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

        items = this.get( "items" );
        height = this.get( "boundingBox" ).get( "clientHeight" );

        Y.Array.each( items, function( item, index, items ){
            var collapsed, itemContentHeight, header, heightSettings, headerHeight;

            header = item.getStdModNode( WidgetStdMod.HEADER );
            heightSettings = item.get( "contentHeight" );
            
            headerHeight = this._getNodeOffsetHeight( header );

            height -= headerHeight;
            collapsed = !item.get( "expanded" );

            if( collapsed ){
                height -= COLLAPSE_HEIGHT;
                return;
            }

            if( heightSettings.method === "stretch" ){
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

        heightSettings = item.get( "contentHeight" );

        if( heightSettings.method === "auto" ){
            body = item.getStdModNode( WidgetStdMod.BODY );
            bodyContent = body.get( "children" ).item(0);
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
        items = this.get( "items" );

        Y.Array.each( items, function( item, index, items ){
            var expanded, alwaysVisible;

            expanded = item.get( "expanded" );
            alwaysVisible = item.get( "alwaysVisible" );

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
        var alwaysVisible = item.get( "alwaysVisible" );

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
        var anim, curAnim, animSettings, expanding = false,
            events = Accordion.EVENT_TYPES,
            accAnimationSettings, body;

        
        function onExpandComplete(){
            delete this._animations[ item ];
            anim = null;

            item.markAsExpanding( false );

            this.fire( events.ITEMERESIZED, {
                'item': item
            });

            if( expanding ){
                this.fire( events.ITEMEXPANDED, {
                    'item': item
                });
            }
        }

        
        body = item.getStdModNode( WidgetStdMod.BODY );

        this.fire( events.BEFOREITEMERESIZED, {
            'item': item
        });

        if( body.get( "clientHeight" ) <= 0 ){
            expanding = true;
            this.fire( events.BEFOREITEMEXPAND, {
                'item': item
            });
        }

        if( !forceSkipAnimation && this.get( "useAnimation" ) ){
            animSettings = item.get( "animation" ) || {};

            anim = new Anim( {
                node: body,
                to: {
                    'height': height
                }
            });

            anim.on( "end", onExpandComplete, this );

            accAnimationSettings = this.get( "animation" );

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
            body.setStyle( "height", height + "px" );

            this.fire( events.ITEMERESIZED, {
                'item': item
            });

            if( expanding ){
                this.fire( events.ITEMEXPANDED, {
                    'item': item
                });
            }
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
        var anim, curAnim, animSettings, accAnimationSettings, events, body, 
            collapsing = (height === COLLAPSE_HEIGHT);
            
        events = Accordion.EVENT_TYPES;
        body = item.getStdModNode( WidgetStdMod.BODY );
        

        function onCollapseComplete(){
            delete this._animations[ item ];
            anim = null;

            item.markAsCollapsing( false );

            this.fire( events.ITEMERESIZED, {
                item: item
            });

            if( collapsing ){
                this.fire( events.ITEMCOLLAPSED, {
                    'item': item
                });
            }
        }

        
        this.fire( events.BEFOREITEMERESIZED, {
            'item': item
        });

        if( collapsing ){
            this.fire( events.BEFOREITEMCOLLAPSE, {
                'item': item
            });
        }

        if( !forceSkipAnimation && this.get( "useAnimation" ) ){
            animSettings = item.get( "animation" ) || {};

            anim = new Anim( {
                node: body,
                to: {
                    'height': height
                }
            });

            anim.on( "end", onCollapseComplete, this );

            accAnimationSettings = this.get( "animation" );

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
            body.setStyle( "height", height + "px" );

            this.fire( events.ITEMERESIZED, {
                'item': item
            });

            if( height === 0 ){
                this.fire( events.ITEMCOLLAPSED, {
                    'item': item
                });
            }
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


        bb = this.get( "boundingBox" );
        itemBB = item.get( "boundingBox" );

        dd = new Y.DD.Drag({
            node: itemHeader,
            groups: [ Accordion.DRAGGROUP ]
        }).plug(Y.Plugin.DDProxy, {
            moveOnEnd: false
        }).plug(Y.Plugin.DDConstrained, {
            constrain2node: bb
        });

        ddrop = new Y.DD.Drop({
            node: itemBB,
            groups: [ Accordion.DRAGGROUP ]
        });

        dd.on( "drag:start", function(e){
            var dragNode, events, item;
            
            item = this.getItem( dd.get( "node" ).get( "parentNode" ) );
            events = Accordion.EVENT_TYPES;
            dragNode = dd.get( "dragNode" );

            dragNode.addClass( Accordion.C_PROXY_VISIBLE );
            dragNode.set( "innerHTML", item.get( "label" ) );
            
            return this.fire( events.BEFOREITEMREORDER, { 'item': item } );
        }, this );

        dd.on( "drag:end", function(e){
            var dragNode, events, item;

            events = Accordion.EVENT_TYPES;
            dragNode = dd.get( "dragNode" );

            dragNode.removeClass( Accordion.C_PROXY_VISIBLE );
            dragNode.set( "innerHTML", "" );
            
            item = this.getItem( dd.get( "node" ).get( "parentNode" ) );
            return this.fire( events.BEFOREENDITEMREORDER, { 'item': item } );
        }, this );
        
        
        dd.after( "drag:end", function(e){
            var events, item, data;
            
            events = Accordion.EVENT_TYPES;

            data = dd.get( "data" );
            
            if( data.drophit ){
                item = this.getItem( dd.get( "node" ).get( "parentNode" ) );

                dd.set( "data", {
                    drophit: false
                } );

                return this.fire( events.ITEMREORDERED, { 'item': item } );
            }
            
            return true;
        }, this );


        dd.on('drag:drophit', function(e) {
            var mineIndex, targetItemIndex, targetItemBB, itemBB, cb, 
                goingUp, items, targetItem;

            targetItem = this.getItem( e.drop.get( "node" ) );

            if( targetItem === item ){
                return false;
            }

            mineIndex = this.getItemIndex( item );
            targetItemIndex = this.getItemIndex( targetItem );
            targetItemBB = targetItem.get( "boundingBox" );
            itemBB = item.get( "boundingBox" );
            cb = this.get( "contentBox" );
            goingUp = false;
            items = this.get( "items" );

            if( targetItemIndex < mineIndex ){
                goingUp = true;
            }

            cb.removeChild( itemBB );

            if( goingUp ){
                cb. insertBefore( itemBB, targetItemBB );
                items.splice( mineIndex, 1 );
                items.splice( targetItemIndex, 0, item );
            } else {
                cb. insertBefore( itemBB, targetItemBB.next( Y.AccordionItem.C_ITEM ) );
                items.splice( targetItemIndex + 1, 0, item );
                items.splice( mineIndex, 1 );
            }
            
            dd.set( "data", {
                drophit: true
            });
            
            return true;
        }, this );

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
        forExpanding  = this._forExpanding;

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
                heightSettings = item.get( "contentHeight" );

                if( heightSettings.method !== "stretch" ){
                    height = this._getItemContentHeight( item );
                }

                this._expandItem( item, height );
            }
        }

        this._forCollapsing = {};
        this._forExpanding  = {};
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
        item     = params.currentTarget;
        alwaysVisible = item.get( "alwaysVisible" );
        collapseOthersOnExpand = this.get( "collapseOthersOnExpand" );
        
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
        item          = params.currentTarget;
        expanded      = item.get( "expanded" );

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
        
        if( params.newVal.method !== "stretch" ){
            expanded = item.get( "expanded" );
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

        if( value === "default" ){
            this._resizeEventHandle = Y.on( 'windowresize', this._adjustStretchItems, this );
        } else {
            this._resizeEventHandle = value.sourceObject.on( value.resizeEvent, this._adjustStretchItems, this );
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

        cb = this.get( "contentBox" );
        itemsDom = cb.queryAll( "> div." + Y.AccordionItem.C_ITEM );

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
        var contentBox, itemChosenEvent, header, itemNode, item, iconAlwaysVisible,
            iconClose, srcIconAlwaysVisible, srcIconExtended, srcIconClose, iconExtended;

        contentBox = this.get( 'contentBox' );
        itemChosenEvent = this.get( 'itemChosen' );
        
        contentBox.delegate( itemChosenEvent, function(e){
            header = e.currentTarget;
            itemNode = header.get( "parentNode" );
            item = this.getItem( itemNode );
            iconAlwaysVisible = item.get( "iconAlwaysVisible" );
            iconClose = item.get( "iconClose" );
            srcIconAlwaysVisible = (iconAlwaysVisible === e.target);
            srcIconClose = (iconClose === e.target);

            this._onItemChosen( item, srcIconAlwaysVisible, srcIconClose );
        }, 'div.yui-widget-hd', this );


        contentBox.delegate( "keypress", function(e){
            var charCode, target = e.target;
            
            charCode = e.charCode;

            if( charCode === 13 ){
                header = e.currentTarget;
                itemNode = header.get( "parentNode" );
                item = this.getItem( itemNode );

                iconAlwaysVisible = item.get( "iconAlwaysVisible" );
                iconExtended = item.get( "iconExtended" );
                iconClose = item.get( "iconClose" );
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
        }, 'div.yui-widget-hd', this );
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
            itemHandles, itemContentBox, events, res, cb, children, itemBoundingBox;

        events = Accordion.EVENT_TYPES;

        res = this.fire( events.BEFOREITEMADD, {
            'item': item
        });

        if( !res ){
            return false;
        }

        items = this.get( "items" );
        contentBox = this.get( 'contentBox' );

        itemContentBox   = item.get( 'contentBox' );
        itemBoundingBox  = item.get( 'boundingBox' );

        if( !itemContentBox.inDoc() ){
            if( parentItem ){
                itemIndex = this.getItemIndex( parentItem );

                if( itemIndex < 0 ){
                    return false;
                }

                items.splice( itemIndex, 0, item );

                if( item.get( "rendered" ) ){
                    contentBox.insertBefore( itemBoundingBox, parentItem.get( 'boundingBox' ) );
                } else {
                    contentBox.insertBefore( itemContentBox, parentItem.get( 'boundingBox' ) );
                }
            } else {
                items.push( item );

                if( item.get( "rendered" ) ){
                    contentBox.insertBefore( itemBoundingBox, null );
                } else {
                    contentBox.insertBefore( itemContentBox, null );
                }
            }
        } else {
            cb = this.get( "contentBox" );
            children = cb.get( "children" );

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

        bodyContent = item.get( "bodyContent" );

        if( !bodyContent ){
            item.set( "bodyContent", "&nbsp;" );
        }

        if( !item.get( "rendered" ) ){
            item.render();
        }
        
        expanded = item.get( "expanded" );
        alwaysVisible = item.get( "alwaysVisible" );

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
            "expandedChange" : item.after( "expandedChange", this._afterItemExpand, this ),
            "alwaysVisibleChange" : item.after( "alwaysVisibleChange", this._afterItemAlwaysVisible, this ),
            "contentHeightChange" : item.after( "contentHeightChange", this._afterContentHeight, this )
        };
        
        this._itemsHandles[ item ] = itemHandles;

        this.fire( events.ITEMADDED, {
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
        var items, bb, item = null, itemIndex, events;
        
        events = Accordion.EVENT_TYPES;
        
        items = this.get( "items" );
        
        if( Lang.isNumber( p_item ) ){
            itemIndex = p_item;
        } else if( p_item instanceof Y.AccordionItem ){
            itemIndex = this.getItemIndex( p_item );
        } else {
            return null;
        }

        if( itemIndex >= 0 ){
            
            this.fire( events.BEFOREITEMREMOVE, {
                item: p_item
            });

            item = items.splice( itemIndex, 1 )[0];

            this._removeItemHandles( item );
            
            bb = item.get( "boundingBox" );
            bb.remove();

            this._adjustStretchItems();
            
            this.fire( events.ITEMREMOVED, {
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
        var items = this.get( "items" ), item = null;

        if( Lang.isNumber( param ) ){
            item = items[ param ];

            return (item instanceof Y.AccordionItem) ? item : null;
        } else if( param instanceof Node ){

            Y.Array.some( items, function( tmpItem, index, items ){
                var contentBox, boundingBox;
                
                contentBox = tmpItem.get( "contentBox" );
                boundingBox = tmpItem.get( "boundingBox" );

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
            items = this.get( "items" );

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

